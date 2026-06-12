const {
  ESCROW_ENABLED,
  CONTRACT_ADDRESS,
  getPublicClient,
  wagerToWei,
} = require("../chain/config");
const { ESCROW_ABI, OnchainMatchStatus } = require("../chain/escrowAbi");

/**
 * Read-side helper around the deployed escrow contract.
 * Used to verify that both players have actually staked before a match starts,
 * rather than trusting the clients' word.
 */
const EscrowService = {
  enabled: ESCROW_ENABLED,
  OnchainMatchStatus,

  /**
   * Read the on-chain Match struct.
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
   * True once player1 has opened the match (status Open or later, before cancel).
   * @param {`0x${string}`} onchainMatchId
   */
  async isCreated(onchainMatchId) {
    const m = await this.getMatch(onchainMatchId);
    if (!m) return false;
    return m.status === OnchainMatchStatus.Open || m.status === OnchainMatchStatus.Active;
  },

  /**
   * True once BOTH players have staked (status Active) — safe to start the game.
   * @param {`0x${string}`} onchainMatchId
   */
  async isActive(onchainMatchId) {
    const m = await this.getMatch(onchainMatchId);
    return m ? m.status === OnchainMatchStatus.Active : false;
  },

  /**
   * Verify the on-chain match matches the expected players and wager.
   * Defends against a client supplying a mismatched stake or wrong identities.
   *
   * @param {`0x${string}`} onchainMatchId
   * @param {{ player1: string, player2: string, wager: number }} expected
   * @returns {Promise<{ ok: boolean, reason?: string, status?: number }>}
   */
  async verifyActiveMatch(onchainMatchId, expected) {
    if (!ESCROW_ENABLED) return { ok: true }; // escrow disabled → nothing to verify
    const m = await this.getMatch(onchainMatchId);
    if (!m) return { ok: false, reason: "match_not_found" };
    if (m.status !== OnchainMatchStatus.Active) {
      return { ok: false, reason: "not_active", status: m.status };
    }
    const expectedWei = wagerToWei(expected.wager);
    if (m.wager !== expectedWei) return { ok: false, reason: "wager_mismatch", status: m.status };

    const lc = (a) => (a || "").toLowerCase();
    const got = [lc(m.player1), lc(m.player2)].sort();
    const want = [lc(expected.player1), lc(expected.player2)].sort();
    if (got[0] !== want[0] || got[1] !== want[1]) {
      return { ok: false, reason: "player_mismatch", status: m.status };
    }
    return { ok: true, status: m.status };
  },
};

module.exports = { EscrowService };
