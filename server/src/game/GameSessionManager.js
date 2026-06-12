const { GameSession } = require("./GameSession");
const { MatchRepository } = require("../repositories");
const { EscrowService } = require("../services/EscrowService");
const {
  ESCROW_ENABLED,
  CONTRACT_ADDRESS,
  CHAIN,
  deriveOnchainMatchId,
} = require("../chain/config");

// How long both players have to stake before the match is abandoned.
const STAKING_DEADLINE_MS = 120_000; // 2 minutes
const START_DELAY_MS = 2_000; // grace for clients to navigate before play

/**
 * Manages all active GameSession instances.
 * Keyed by matchId. Also tracks userId → matchId for fast disconnect lookup.
 *
 * When escrow is enabled, a match goes through a staking handshake
 * (createMatch → joinMatch on-chain) before the game starts. When escrow is
 * disabled (local dev / no deployed contract), the game starts immediately.
 */
class GameSessionManager {
  constructor() {
    /** @type {Map<string, GameSession>} */
    this._sessions = new Map();

    /** @type {Map<string, string>} userId → matchId */
    this._playerIndex = new Map();

    /** @type {Map<string, ReturnType<typeof setTimeout>>} matchId → staking deadline timer */
    this._stakeTimers = new Map();
  }

  /**
   * Create a new match. When escrow is enabled the session waits for both
   * players to stake; otherwise it starts after a short delay.
   *
   * @param {{ userId, socketId, walletAddress }} player1  on-chain creator
   * @param {{ userId, socketId, walletAddress }} player2  on-chain joiner
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

    // Notify both clients. Roles + escrow details let the client drive the
    // create/join flow and submit the right transaction.
    const basePayload = {
      matchId,
      wager,
      escrowEnabled: ESCROW_ENABLED,
      onchainMatchId,
      contractAddress: ESCROW_ENABLED ? CONTRACT_ADDRESS : null,
      chainId: ESCROW_ENABLED ? CHAIN.id : null,
    };

    this._emitTo(io, player1.socketId, "match_found", {
      ...basePayload,
      role: "creator",
      opponentAddress: player2.walletAddress,
    });
    this._emitTo(io, player2.socketId, "match_found", {
      ...basePayload,
      role: "joiner",
      opponentAddress: player1.walletAddress,
    });

    if (!ESCROW_ENABLED) {
      // Legacy path — no staking, start straight away.
      setTimeout(() => session.start(), START_DELAY_MS);
      this._scheduleCleanup(matchId, player1.userId, player2.userId);
    } else {
      // Abandon the match if both haven't staked in time.
      const timer = setTimeout(() => this._expireStaking(matchId, io), STAKING_DEADLINE_MS);
      this._stakeTimers.set(matchId, timer);
    }

    return session;
  }

  /**
   * A client reports that its on-chain stake transaction has confirmed.
   * The server VERIFIES against the chain rather than trusting the client.
   *
   * @param {string} userId
   * @param {string} matchId
   * @param {import("socket.io").Server} io
   */
  async handleStakeConfirmation(userId, matchId, io) {
    const session = this._sessions.get(matchId);
    if (!session || !session.escrowEnabled || session.isStarted()) return;

    let onchain;
    try {
      onchain = await EscrowService.getMatch(session.onchainMatchId);
    } catch (err) {
      console.error(`[Escrow] Failed reading match ${matchId}:`, err);
      this._emitToUser(io, userId, "escrow_error", {
        matchId,
        message: "Could not verify your stake on-chain. Please retry.",
      });
      return;
    }

    const { NonExistent, Open, Active } = EscrowService.OnchainMatchStatus;
    if (!onchain || onchain.status === NonExistent) {
      return; // tx not yet visible — client may retry
    }

    if (onchain.status === Open) {
      await MatchRepository.setEscrow(matchId, { status: "open" });
      // Tell both players the creator's stake is locked so the joiner can stake.
      this._emitTo(io, session.player1.socketId, "escrow_update", { matchId, escrowStatus: "open" });
      this._emitTo(io, session.player2.socketId, "escrow_update", { matchId, escrowStatus: "open" });
      return;
    }

    if (onchain.status === Active) {
      // Verify identities + wager match expectations before releasing the game.
      const check = await EscrowService.verifyActiveMatch(session.onchainMatchId, {
        player1: session.player1.walletAddress,
        player2: session.player2.walletAddress,
        wager: session.wager,
      });
      if (!check.ok) {
        console.warn(`[Escrow] Verification failed for ${matchId}: ${check.reason}`);
        const msg = { matchId, message: `Stake verification failed (${check.reason}).` };
        this._emitTo(io, session.player1.socketId, "escrow_error", msg);
        this._emitTo(io, session.player2.socketId, "escrow_error", msg);
        return;
      }

      // Both staked & verified — clear the deadline and start the game.
      this._clearStakeTimer(matchId);
      await MatchRepository.setEscrow(matchId, { status: "active" });
      await MatchRepository.setStatus(matchId, "active");

      this._emitTo(io, session.player1.socketId, "escrow_ready", { matchId });
      this._emitTo(io, session.player2.socketId, "escrow_ready", { matchId });

      setTimeout(() => session.start(), START_DELAY_MS);
      this._scheduleCleanup(matchId, session.player1.userId, session.player2.userId);
    }
  }

  /** Abandon a match whose players failed to stake in time. */
  async _expireStaking(matchId, io) {
    const session = this._sessions.get(matchId);
    this._clearStakeTimer(matchId);
    if (!session || session.isStarted()) return;

    await MatchRepository.setStatus(matchId, "cancelled").catch(() => {});
    await MatchRepository.setEscrow(matchId, { status: "cancelled" }).catch(() => {});

    this._emitTo(io, session.player1.socketId, "escrow_expired", { matchId });
    this._emitTo(io, session.player2.socketId, "escrow_expired", { matchId });

    this._sessions.delete(matchId);
    this._playerIndex.delete(session.player1.userId);
    this._playerIndex.delete(session.player2.userId);
    console.log(`[Escrow] Match ${matchId} expired — players did not both stake.`);
  }

  _scheduleCleanup(matchId, userId1, userId2) {
    setTimeout(() => {
      this._sessions.delete(matchId);
      this._playerIndex.delete(userId1);
      this._playerIndex.delete(userId2);
    }, 70_000);
  }

  _clearStakeTimer(matchId) {
    const t = this._stakeTimers.get(matchId);
    if (t) clearTimeout(t);
    this._stakeTimers.delete(matchId);
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

  /** @param {string} matchId */
  getSession(matchId) {
    return this._sessions.get(matchId);
  }

  /** @param {string} userId */
  getSessionByUserId(userId) {
    const matchId = this._playerIndex.get(userId);
    return matchId ? this._sessions.get(matchId) : undefined;
  }

  /**
   * Call when a player disconnects — forwards to the active session if any.
   * @param {string} userId
   */
  handleDisconnect(userId) {
    const session = this.getSessionByUserId(userId);
    if (session) {
      session.handlePlayerDisconnect(userId);
    }
  }
}

// Singleton
const gameSessionManager = new GameSessionManager();
module.exports = { gameSessionManager };
