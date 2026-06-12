const { Match } = require("../models");

const MatchRepository = {
  /**
   * Create a new match in "pending" status.
   * @param {{ player1: string, player2: string, wager: number }} data
   */
  async create(data) {
    const match = new Match({
      player1: data.player1,
      player2: data.player2,
      wager: data.wager,
      ...(data.onchainMatchId ? { onchainMatchId: data.onchainMatchId } : {}),
      ...(data.escrow ? { escrow: data.escrow } : {}),
    });
    return match.save();
  },

  /**
   * Store the deterministic on-chain matchId for this match.
   * @param {string} id
   * @param {string} onchainMatchId
   */
  async setOnchainMatchId(id, onchainMatchId) {
    return Match.findByIdAndUpdate(
      id,
      { $set: { onchainMatchId } },
      { new: true }
    ).exec();
  },

  /**
   * Update the escrow handshake sub-document.
   * @param {string} id
   * @param {{ status?: string, creator?: string, joiner?: string }} escrow
   */
  async setEscrow(id, escrow) {
    const $set = {};
    if (escrow.status !== undefined) $set["escrow.status"] = escrow.status;
    if (escrow.creator !== undefined) $set["escrow.creator"] = escrow.creator;
    if (escrow.joiner !== undefined) $set["escrow.joiner"] = escrow.joiner;
    return Match.findByIdAndUpdate(id, { $set }, { new: true }).exec();
  },

  /**
   * Update the settlement sub-document. Only provided fields are written.
   * @param {string} id
   * @param {{ status?: string, txHash?: string, winnerAddress?: string, error?: string }} settlement
   */
  async setSettlement(id, settlement) {
    const $set = {};
    if (settlement.status !== undefined) $set["settlement.status"] = settlement.status;
    if (settlement.txHash !== undefined) $set["settlement.txHash"] = settlement.txHash;
    if (settlement.winnerAddress !== undefined)
      $set["settlement.winnerAddress"] = settlement.winnerAddress;
    if (settlement.error !== undefined) $set["settlement.error"] = settlement.error;
    return Match.findByIdAndUpdate(id, { $set }, { new: true }).exec();
  },

  /**
   * Find a match by its MongoDB ObjectId, with players populated.
   * @param {string} id
   */
  async findById(id) {
    return Match.findById(id).populate("player1 player2 winner").exec();
  },

  /**
   * Update match status (e.g. pending → active → completed).
   * @param {string} id
   * @param {"pending"|"active"|"completed"|"cancelled"} status
   */
  async setStatus(id, status) {
    return Match.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true }
    ).exec();
  },

  /**
   * Record final scores and winner, mark match as completed.
   * @param {string} id
   * @param {{ score1: number, score2: number, winner: string|null }} data
   */
  async finalize(id, data) {
    return Match.findByIdAndUpdate(
      id,
      {
        $set: {
          score1: data.score1,
          score2: data.score2,
          winner: data.winner,
          status: "completed",
        },
      },
      { new: true }
    )
      .populate("player1 player2 winner")
      .exec();
  },

  /**
   * Get all matches for a given player (as either player1 or player2).
   * @param {string} playerId
   * @param {number} limit
   * @param {number} skip
   */
  async findByPlayer(playerId, limit = 20, skip = 0) {
    return Match.find({
      $or: [{ player1: playerId }, { player2: playerId }],
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("player1 player2 winner")
      .exec();
  },

  /**
   * Get all matches with a specific status.
   * @param {"pending"|"active"|"completed"|"cancelled"} status
   * @param {number} limit
   */
  async findByStatus(status, limit = 50) {
    return Match.find({ status })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("player1 player2")
      .exec();
  },

  /**
   * Cancel a match — only succeeds if still pending or active.
   * @param {string} id
   */
  async cancel(id) {
    return Match.findOneAndUpdate(
      { _id: id, status: { $in: ["pending", "active"] } },
      { $set: { status: "cancelled" } },
      { new: true }
    ).exec();
  },

  /**
   * Delete a match by ID.
   * @param {string} id
   */
  async deleteById(id) {
    const result = await Match.deleteOne({ _id: id }).exec();
    return result.deletedCount === 1;
  },
};

module.exports = { MatchRepository };
