const {
  ESCROW_ENABLED,
  CONTRACT_ADDRESS,
  getPublicClient,
  getWalletClient,
  wagerToWei,
} = require("../chain/config");
const { ESCROW_ABI, OnchainMatchStatus } = require("../chain/escrowAbi");

/**
 * On-chain helpers for the symmetric MathsBlitzEscrow contract.
 */
const EscrowService = {
  enabled: ESCROW_ENABLED,
  OnchainMatchStatus,

  /**
   * Read a player's on-chain Reservation struct.
   * @param {`0x${string}`} reservationId
   * @returns {Promise<{ player: string, amount: bigint, linked: boolean } | null>}
   */
  async getReservation(reservationId) {
    if (!ESCROW_ENABLED) return null;
    const r = await getPublicClient().readContract({
      address: CONTRACT_ADDRESS,
      abi: ESCROW_ABI,
      functionName: "getReservation",
      args: [reservationId],
    });
    return { player: r.player, amount: r.amount, linked: r.linked };
  },

  /**
   * Verify that a reservation exists on-chain with the expected player and wager.
   * Retries up to 5 times with 2 s delays to handle RPC indexing lag after a
   * freshly mined transaction.
   *
   * @param {`0x${string}`} reservationId
   * @param {string} expectedPlayer  wallet address
   * @param {number} expectedWager   wager in CELO (e.g. 0.01)
   * @returns {Promise<{ ok: boolean, reason?: string }>}
   */
  async isReservationValid(reservationId, expectedPlayer, expectedWager) {
    if (!ESCROW_ENABLED) return { ok: true };

    const RETRIES = 5;
    const DELAY_MS = 2_000;

    for (let attempt = 1; attempt <= RETRIES; attempt++) {
      const r = await this.getReservation(reservationId);

      if (!r || r.player === "0x0000000000000000000000000000000000000000") {
        if (attempt < RETRIES) {
          console.log(`[Escrow] reservation_not_found (attempt ${attempt}/${RETRIES}), retrying in ${DELAY_MS}ms…`);
          await new Promise((res) => setTimeout(res, DELAY_MS));
          continue;
        }
        return { ok: false, reason: "reservation_not_found" };
      }

      if (r.linked) return { ok: false, reason: "already_linked" };

      if (r.player.toLowerCase() !== expectedPlayer.toLowerCase()) {
        return { ok: false, reason: "player_mismatch" };
      }

      const expectedWei = wagerToWei(expectedWager);
      if (r.amount !== expectedWei) {
        return { ok: false, reason: "wager_mismatch" };
      }

      return { ok: true };
    }

    return { ok: false, reason: "reservation_not_found" };
  },

  /**
   * Read the on-chain Match struct (after linkMatch has been called).
   * @param {`0x${string}`} onchainMatchId
   * @returns {Promise<{ player1: string, player2: string, wager: bigint, status: number } | null>}
   */
  async getMatch(onchainMatchId) {
    if (!ESCROW_ENABLED) return null;
    const m = await getPublicClient().readContract({
      address: CONTRACT_ADDRESS,
      abi: ESCROW_ABI,
      functionName: "getMatch",
      args: [onchainMatchId],
    });
    return { player1: m.player1, player2: m.player2, wager: m.wager, status: Number(m.status) };
  },

  /**
   * Submit linkMatch on-chain. Called by the server once two players are matched.
   * Waits for the transaction to be mined.
   *
   * @param {`0x${string}`} matchId
   * @param {`0x${string}`} reservationA
   * @param {`0x${string}`} reservationB
   * @returns {Promise<`0x${string}`>} transaction hash
   */
  async linkMatch(matchId, reservationA, reservationB) {
    const walletClient = getWalletClient();
    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: ESCROW_ABI,
      functionName: "linkMatch",
      args: [matchId, reservationA, reservationB],
    });
    await getPublicClient().waitForTransactionReceipt({ hash });
    return hash;
  },
};

module.exports = { EscrowService };
