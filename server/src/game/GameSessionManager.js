const { GameSession } = require("./GameSession");
const { MatchRepository } = require("../repositories");
const { EscrowService } = require("../services/EscrowService");
const {
  ESCROW_ENABLED,
  CONTRACT_ADDRESS,
  CHAIN,
  deriveOnchainMatchId,
  deriveReservationId,
} = require("../chain/config");
const { QueueManager } = require("./QueueManager");

const START_DELAY_MS = 2_000; // grace period for clients to navigate before play starts

/**
 * Manages all active GameSession instances and the pre-queue staking flow.
 *
 * New symmetric flow (escrow enabled):
 *   1. Player emits stake_and_queue → createReservation() → server sends reservation_ready
 *   2. Player calls depositStake on-chain, then emits confirm_stake { reservationId }
 *   3. handleStakeConfirmation() verifies on-chain, enqueues player, emits queue_joined
 *   4. QueueManager matches two players → createSession() → server calls linkMatch on-chain
 *   5. Both clients receive match_found → navigate to game
 *
 * Escrow-disabled path: createReservation is skipped; join_queue enqueues directly.
 */
class GameSessionManager {
  constructor() {
    /** @type {Map<string, GameSession>} matchId → session */
    this._sessions = new Map();

    /** @type {Map<string, string>} userId → matchId */
    this._playerIndex = new Map();

    /**
     * Pending reservations awaiting on-chain confirmation.
     * @type {Map<string, { reservationId: string, wager: number, socketId: string, walletAddress: string }>}
     * userId → reservation info
     */
    this._pendingReservations = new Map();
  }

  // ── Pre-queue staking ──────────────────────────────────────────────────────

  /**
   * Generate a reservation ID and send it to the client so they can call
   * depositStake on-chain before entering the queue.
   * No-op if escrow is disabled (handled by direct join_queue flow).
   *
   * @param {{ userId: string, socketId: string, walletAddress: string }} player
   * @param {number} wager
   * @param {import("socket.io").Server} io
   */
  createReservation(player, wager, io) {
    if (!ESCROW_ENABLED) return;

    // Overwrite any stale pending reservation for this player.
    const reservationId = deriveReservationId(player.userId, Date.now());
    this._pendingReservations.set(player.userId, {
      reservationId,
      wager,
      socketId: player.socketId,
      walletAddress: player.walletAddress,
    });

    const socket = io.sockets.sockets.get(player.socketId);
    if (socket) {
      socket.emit("reservation_ready", {
        reservationId,
        contractAddress: CONTRACT_ADDRESS,
        chainId: CHAIN.id,
        wager,
      });
    }

    console.log(`[Escrow] Reservation created for ${player.userId}: ${reservationId}`);
  }

  /**
   * Client reports their depositStake tx has confirmed. Server verifies on-chain,
   * then enqueues the player. Emits queue_joined on success.
   *
   * @param {string} userId
   * @param {`0x${string}`} reservationId
   * @param {import("socket.io").Server} io
   */
  async handleStakeConfirmation(userId, reservationId, io) {
    const pending = this._pendingReservations.get(userId);
    if (!pending) {
      console.warn(`[Escrow] confirm_stake from unknown user ${userId}`);
      return;
    }
    if (pending.reservationId !== reservationId) {
      console.warn(`[Escrow] reservationId mismatch for ${userId}`);
      this._emitToUser(io, userId, "escrow_error", {
        message: "Reservation ID mismatch. Please try again.",
      });
      return;
    }

    const check = await EscrowService.isReservationValid(
      reservationId,
      pending.walletAddress,
      pending.wager
    );

    if (!check.ok) {
      console.warn(`[Escrow] Invalid reservation for ${userId}: ${check.reason}`);
      this._emitToUser(io, userId, "escrow_error", {
        message: `Stake verification failed (${check.reason}). Please try again.`,
      });
      return;
    }

    this._pendingReservations.delete(userId);

    // Player is staked and verified — add to the matchmaking queue.
    const player = {
      userId,
      socketId: pending.socketId,
      walletAddress: pending.walletAddress,
      reservationId,
    };
    QueueManager.enqueue(player, pending.wager, io);

    // Notify the client they're now in the queue.
    const socket = io.sockets.sockets.get(pending.socketId);
    if (socket) socket.emit("queue_joined", { wager: pending.wager });

    console.log(`[Escrow] ${userId} stake verified — added to ${pending.wager} CELO queue`);
  }

  // ── Session lifecycle ──────────────────────────────────────────────────────

  /**
   * Called by QueueManager when two players are matched.
   * If escrow is enabled, calls linkMatch on-chain before starting the game.
   *
   * @param {{ userId, socketId, walletAddress, reservationId? }} player1
   * @param {{ userId, socketId, walletAddress, reservationId? }} player2
   * @param {number} wager
   * @param {import("socket.io").Server} io
   */
  async createSession(player1, player2, wager, io) {
    const match = await MatchRepository.create({
      player1: player1.userId,
      player2: player2.userId,
      wager,
    });
    const matchId = match._id.toString();
    const onchainMatchId = ESCROW_ENABLED ? deriveOnchainMatchId(matchId) : null;

    if (ESCROW_ENABLED) {
      await MatchRepository.setOnchainMatchId(matchId, onchainMatchId);
      await MatchRepository.setEscrow(matchId, {
        status: "none",
        creator: player1.walletAddress,
        joiner: player2.walletAddress,
      });
    } else {
      await MatchRepository.setStatus(matchId, "active");
    }

    const session = new GameSession({ matchId, player1, player2, wager, io });
    session.onchainMatchId = onchainMatchId;
    session.escrowEnabled = ESCROW_ENABLED;

    this._sessions.set(matchId, session);
    this._playerIndex.set(player1.userId, matchId);
    this._playerIndex.set(player2.userId, matchId);

    if (ESCROW_ENABLED) {
      // Link the two pre-staked reservations on-chain before notifying clients.
      try {
        await EscrowService.linkMatch(
          onchainMatchId,
          player1.reservationId,
          player2.reservationId
        );
        await MatchRepository.setEscrow(matchId, { status: "active" });
        await MatchRepository.setStatus(matchId, "active");
        console.log(`[Escrow] linkMatch confirmed for ${matchId}`);
      } catch (err) {
        console.error(`[Escrow] linkMatch failed for ${matchId}:`, err);
        await MatchRepository.setStatus(matchId, "cancelled").catch(() => {});
        this._emitTo(io, player1.socketId, "escrow_error", {
          message: "Failed to link your stakes on-chain. Both stakes will remain withdrawable.",
        });
        this._emitTo(io, player2.socketId, "escrow_error", {
          message: "Failed to link your stakes on-chain. Both stakes will remain withdrawable.",
        });
        this._sessions.delete(matchId);
        this._playerIndex.delete(player1.userId);
        this._playerIndex.delete(player2.userId);
        return;
      }
    }

    const payload = {
      matchId,
      wager,
      escrowEnabled: ESCROW_ENABLED,
      onchainMatchId,
      contractAddress: ESCROW_ENABLED ? CONTRACT_ADDRESS : null,
      chainId: ESCROW_ENABLED ? CHAIN.id : null,
      opponentAddress: null, // filled per-player below
    };

    this._emitTo(io, player1.socketId, "match_found", {
      ...payload,
      opponentAddress: player2.walletAddress,
    });
    this._emitTo(io, player2.socketId, "match_found", {
      ...payload,
      opponentAddress: player1.walletAddress,
    });

    setTimeout(() => session.start(), START_DELAY_MS);
    this._scheduleCleanup(matchId, player1.userId, player2.userId);

    return session;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _scheduleCleanup(matchId, userId1, userId2) {
    setTimeout(() => {
      this._sessions.delete(matchId);
      this._playerIndex.delete(userId1);
      this._playerIndex.delete(userId2);
    }, 70_000);
  }

  _emitTo(io, socketId, event, payload) {
    const s = io.sockets.sockets.get(socketId);
    if (s) s.emit(event, payload);
  }

  _emitToUser(io, userId, event, payload) {
    for (const [, s] of io.sockets.sockets) {
      if (s.userId === userId) {
        s.emit(event, payload);
        break;
      }
    }
  }

  getSession(matchId) {
    return this._sessions.get(matchId);
  }

  getSessionByUserId(userId) {
    const matchId = this._playerIndex.get(userId);
    return matchId ? this._sessions.get(matchId) : undefined;
  }

  handleDisconnect(userId) {
    const session = this.getSessionByUserId(userId);
    if (session) session.handlePlayerDisconnect(userId);
    // Also clean up any pending reservation.
    this._pendingReservations.delete(userId);
  }
}

const gameSessionManager = new GameSessionManager();
module.exports = { gameSessionManager };
