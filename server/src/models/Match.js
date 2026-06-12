const { Schema, model } = require("mongoose");

// MatchStatus enum values: "pending" | "active" | "completed" | "cancelled"

const MatchSchema = new Schema(
  {
    player1: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    player2: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    wager: {
      type: Number,
      required: true,
      min: 0,
    },
    score1: {
      type: Number,
      default: 0,
      min: 0,
    },
    score2: {
      type: Number,
      default: 0,
      min: 0,
    },
    winner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "active", "completed", "cancelled"],
      default: "pending",
      index: true,
    },

    // ── On-chain escrow (Phase 3) ────────────────────────────────────────────
    /** Deterministic bytes32 matchId used in the escrow contract. */
    onchainMatchId: {
      type: String,
      default: null,
      index: true,
    },
    /** Staking handshake state, mirrors the contract's match lifecycle. */
    escrow: {
      /** "none" before staking, "open" once creator stakes, "active" once both staked. */
      status: {
        type: String,
        enum: ["none", "open", "active", "cancelled"],
        default: "none",
      },
      /** Wallet address designated as the on-chain creator (player1). */
      creator: { type: String, default: null },
      /** Wallet address designated as the on-chain joiner (player2). */
      joiner: { type: String, default: null },
    },
    /** Settlement transaction tracking — prevents double settlement. */
    settlement: {
      status: {
        type: String,
        enum: [
          "none",
          "pending",
          "submitted",
          "confirmed",
          "failed",
          "skipped_draw",
        ],
        default: "none",
      },
      txHash: { type: String, default: null },
      winnerAddress: { type: String, default: null },
      error: { type: String, default: null },
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for quick player history and status queries
MatchSchema.index({ player1: 1, player2: 1 });
MatchSchema.index({ status: 1, createdAt: -1 });

const Match = model("Match", MatchSchema);

module.exports = { Match };
