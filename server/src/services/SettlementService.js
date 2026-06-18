const { keccak256, encodePacked, getAddress } = require("viem");
const {
  ESCROW_ENABLED,
  CONTRACT_ADDRESS,
  CHAIN,
  getWalletClient,
  runWalletTransaction,
  getPublicClient,
  getSettlementAccount,
} = require("../chain/config");
const { ESCROW_ABI, OnchainMatchStatus } = require("../chain/escrowAbi");
const { MatchRepository } = require("../repositories");

/**
 * Backend settlement service.
 *
 * Responsibilities (Phase 3):
 *   - receive a finished match result
 *   - determine the winner's wallet address
 *   - sign the settlement digest with the authorised signer key
 *   - submit the settleMatch transaction
 *   - update the match's settlement status
 *
 * Double-settlement is prevented at three layers:
 *   1. in-memory lock      — one settlement in flight per match
 *   2. DB settlement.status — skip matches already submitted/confirmed
 *   3. on-chain             — contract reverts once a match leaves Active
 */

/** @type {Set<string>} dbMatchIds currently being settled */
const _inFlight = new Set();

/**
 * Compute the EIP-191-prefixed digest the contract expects, matching
 * MathsBlitzEscrow._settlementDigest + MessageHashUtils.toEthSignedMessageHash.
 * @param {`0x${string}`} onchainMatchId
 * @param {`0x${string}`} winner
 * @returns {`0x${string}`} the raw 32-byte digest (pre-EIP-191)
 */
function settlementDigest(onchainMatchId, winner) {
  return keccak256(
    encodePacked(
      ["bytes32", "address", "address", "uint256"],
      [onchainMatchId, winner, CONTRACT_ADDRESS, BigInt(CHAIN.id)]
    )
  );
}

const SettlementService = {
  enabled: ESCROW_ENABLED,

  /**
   * Sign the settlement digest with the authorised signer key.
   * viem's `signMessage({ message: { raw } })` applies the same
   * "\x19Ethereum Signed Message:\n32" prefix the contract recovers against.
   * @param {`0x${string}`} onchainMatchId
   * @param {`0x${string}`} winner
   * @returns {Promise<`0x${string}`>}
   */
  async sign(onchainMatchId, winner) {
    const account = getSettlementAccount();
    const digest = settlementDigest(onchainMatchId, getAddress(winner));
    return account.signMessage({ message: { raw: digest } });
  },

  /**
   * Settle a finished match on-chain. Idempotent — safe to call more than once.
   *
   * @param {string} dbMatchId         Mongo match _id
   * @param {string|null} winnerAddress Winner's wallet address, or null for a draw
   * @returns {Promise<{ status: string, txHash?: string, reason?: string }>}
   */
  async settle(dbMatchId, winnerAddress) {
    if (!ESCROW_ENABLED) {
      return { status: "skipped", reason: "escrow_disabled" };
    }

    // Layer 1: in-memory lock
    if (_inFlight.has(dbMatchId)) {
      return { status: "in_progress", reason: "already_in_flight" };
    }
    _inFlight.add(dbMatchId);

    try {
      const match = await MatchRepository.findById(dbMatchId);
      if (!match) return { status: "error", reason: "match_not_found" };

      const onchainMatchId = match.onchainMatchId;
      if (!onchainMatchId) return { status: "skipped", reason: "no_onchain_match" };

      // Draw — refund both players via refundDraw (authorized signer call).
      if (!winnerAddress) {
        await MatchRepository.setSettlement(dbMatchId, { status: "pending" });
        const walletClient = getWalletClient();
        const txHash = await runWalletTransaction(async () => {
          const hash = await walletClient.writeContract({
            address: CONTRACT_ADDRESS,
            abi: ESCROW_ABI,
            functionName: "refundDraw",
            args: [onchainMatchId],
          });
          const receipt = await getPublicClient().waitForTransactionReceipt({ hash });
          if (receipt.status !== "success") {
            throw new Error("refundDraw transaction reverted");
          }
          return hash;
        });
        await MatchRepository.setSettlement(dbMatchId, { status: "confirmed", txHash });
        console.log(`[Settlement] Draw refund confirmed for ${dbMatchId} (tx: ${txHash})`);
        return { status: "confirmed", txHash };
      }

      // Layer 2: DB status guard
      const current = match.settlement?.status;
      if (current === "confirmed" || current === "submitted") {
        return { status: current, reason: "already_settled" };
      }

      const winner = getAddress(winnerAddress);

      // Reconcile with chain: if already settled on-chain, just record it.
      const onchain = await getPublicClient().readContract({
        address: CONTRACT_ADDRESS,
        abi: ESCROW_ABI,
        functionName: "getMatch",
        args: [onchainMatchId],
      });
      const onchainStatus = Number(onchain.status);
      if (onchainStatus === OnchainMatchStatus.Settled) {
        await MatchRepository.setSettlement(dbMatchId, {
          status: "confirmed",
          winnerAddress: winner,
        });
        return { status: "confirmed", reason: "already_settled_onchain" };
      }
      if (onchainStatus !== OnchainMatchStatus.Active) {
        await MatchRepository.setSettlement(dbMatchId, {
          status: "failed",
          error: `unexpected_onchain_status_${onchainStatus}`,
        });
        return { status: "error", reason: `onchain_status_${onchainStatus}` };
      }

      // Mark pending before submitting
      await MatchRepository.setSettlement(dbMatchId, { status: "pending", winnerAddress: winner });

      // Sign + submit
      const signature = await this.sign(onchainMatchId, winner);
      const walletClient = getWalletClient();
      const txHash = await runWalletTransaction(async () => {
        const hash = await walletClient.writeContract({
          address: CONTRACT_ADDRESS,
          abi: ESCROW_ABI,
          functionName: "settleMatch",
          args: [onchainMatchId, winner, signature],
        });
        const receipt = await getPublicClient().waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") {
          throw new Error("settleMatch transaction reverted");
        }
        return hash;
      });

      await MatchRepository.setSettlement(dbMatchId, { status: "submitted", txHash, winnerAddress: winner });

      await MatchRepository.setSettlement(dbMatchId, {
        status: "confirmed",
        txHash,
        winnerAddress: winner,
      });

      console.log(`[Settlement] Match ${dbMatchId} confirmed (tx: ${txHash})`);
      return { status: "confirmed", txHash };
    } catch (err) {
      console.error(`[Settlement] Failed to settle match ${dbMatchId}:`, err);
      await MatchRepository.setSettlement(dbMatchId, {
        status: "failed",
        error: String(err?.shortMessage || err?.message || err),
      }).catch(() => {});
      return { status: "error", reason: String(err?.shortMessage || err?.message || err) };
    } finally {
      _inFlight.delete(dbMatchId);
    }
  },
};

module.exports = { SettlementService, settlementDigest };
