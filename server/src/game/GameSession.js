const { generate } = require("./QuestionGenerator");
const { MatchRepository, UserRepository } = require("../repositories");
const { SettlementService } = require("../services/SettlementService");

const MATCH_DURATION_MS = 30_000; // 30 seconds — blitz format

/**
 * Manages a single live match between two players.
 */
class GameSession {
  /**
   * @param {object} opts
   * @param {string} opts.matchId
   * @param {{ userId: string, socketId: string, walletAddress: string }} opts.player1
   * @param {{ userId: string, socketId: string, walletAddress: string }} opts.player2
   * @param {number} opts.wager
   * @param {import("socket.io").Server} opts.io
   */
  constructor({ matchId, player1, player2, wager, io }) {
    this.matchId = matchId;
    this.player1 = player1;
    this.player2 = player2;
    this.wager = wager;
    this.io = io;
    this.roomId = `match:${matchId}`;

    // Score tracking — keyed by userId
    this.scores = {
      [player1.userId]: 0,
      [player2.userId]: 0,
    };

    // Per-player current question (server-side, includes answer)
    this._currentQuestions = {
      [player1.userId]: null,
      [player2.userId]: null,
    };

    // Per-player set of questionIds already answered (replay attack prevention)
    this._answered = {
      [player1.userId]: new Set(),
      [player2.userId]: new Set(),
    };

    this._startedAt = null;
    this._elapsed = 0; // seconds
    this._matchTimer = null;
    this._started = false;
    this._ended = false;

    // Set by GameSessionManager when escrow is in play.
    this.onchainMatchId = null;
    this.escrowEnabled = false;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** @returns {boolean} whether the game has begun (or finished). */
  isStarted() {
    return this._started;
  }

  start() {
    if (this._started || this._ended) return;
    this._started = true;
    this._startedAt = Date.now();

    // Both sockets join the match room
    const s1 = this.io.sockets.sockets.get(this.player1.socketId);
    const s2 = this.io.sockets.sockets.get(this.player2.socketId);
    if (s1) s1.join(this.roomId);
    if (s2) s2.join(this.roomId);

    // Notify both players
    this.io.to(this.roomId).emit("game_started", {
      matchId: this.matchId,
      durationSeconds: MATCH_DURATION_MS / 1000,
      players: {
        [this.player1.userId]: this.player1.walletAddress,
        [this.player2.userId]: this.player2.walletAddress,
      },
    });

    // Send each player their own first question
    this._sendNewQuestionToPlayer(this.player1.userId);
    this._sendNewQuestionToPlayer(this.player2.userId);

    // Tick every second for elapsed time tracking
    this._matchTimer = setInterval(() => this._tick(), 1000);

    // End match after 30 seconds
    setTimeout(() => this._endMatch(), MATCH_DURATION_MS);
  }

  /**
   * Handle an answer submission from a player.
   * @param {string} userId
   * @param {string} questionId
   * @param {number} answer
   * @returns {{ correct: boolean, score: number }}
   */
  handleAnswer(userId, questionId, answer) {
    if (this._ended) return { correct: false, score: this.scores[userId] ?? 0 };

    const q = this._currentQuestions[userId];
    if (!q || q.id !== questionId) {
      return { correct: false, score: this.scores[userId] ?? 0 };
    }

    // Replay attack guard — each player can only answer each question once
    if (this._answered[userId]?.has(questionId)) {
      return { correct: false, score: this.scores[userId] ?? 0 };
    }
    this._answered[userId].add(questionId);

    const correct = Number(answer) === q.answer;
    if (correct) {
      this.scores[userId] = (this.scores[userId] ?? 0) + 1;
    }

    // Emit score update to room
    this.io.to(this.roomId).emit("score_update", {
      matchId: this.matchId,
      scores: { ...this.scores },
    });

    // On correct answer, advance only this player to their next question
    if (correct) {
      this._sendNewQuestionToPlayer(userId);
    }

    return { correct, score: this.scores[userId] };
  }

  /**
   * Handle one player disconnecting mid-match.
   * @param {string} userId
   */
  handlePlayerDisconnect(userId) {
    if (this._ended) return;
    this.io.to(this.roomId).emit("opponent_disconnected", {
      matchId: this.matchId,
    });
    // End the match — the disconnected player forfeits
    this._endMatch(userId === this.player1.userId ? this.player2.userId : this.player1.userId);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _tick() {
    this._elapsed += 1;
  }

  /**
   * Send a fresh question to a single player via their socket.
   * @param {string} userId
   */
  _sendNewQuestionToPlayer(userId) {
    const q = generate(this._elapsed);
    this._currentQuestions[userId] = q;

    const playerInfo =
      userId === this.player1.userId ? this.player1 : this.player2;
    const targetSocket = this.io.sockets.sockets.get(playerInfo.socketId);

    const { answer: _answer, ...clientQuestion } = q;
    void _answer;

    if (targetSocket) {
      targetSocket.emit("new_question", {
        matchId: this.matchId,
        question: clientQuestion,
      });
    }
  }

  /**
   * Handle a skip request — advance this player to a new question without scoring.
   * @param {string} userId
   * @param {string} questionId - must match the player's current question
   */
  handleSkip(userId, questionId) {
    if (this._ended) return;
    const q = this._currentQuestions[userId];
    if (!q || q.id !== questionId) return;
    this._sendNewQuestionToPlayer(userId);
  }

  async _endMatch(forcedWinnerId = null) {
    if (this._ended) return;
    this._ended = true;

    clearInterval(this._matchTimer);
    clearInterval(this._questionTimer);

    // Determine winner
    let winnerId = forcedWinnerId;
    if (!winnerId) {
      const s1 = this.scores[this.player1.userId] ?? 0;
      const s2 = this.scores[this.player2.userId] ?? 0;
      if (s1 > s2) winnerId = this.player1.userId;
      else if (s2 > s1) winnerId = this.player2.userId;
      // null = draw
    }

    // Persist match result and update player stats
    try {
      await MatchRepository.finalize(this.matchId, {
        score1: this.scores[this.player1.userId] ?? 0,
        score2: this.scores[this.player2.userId] ?? 0,
        winner: winnerId,
      });

      const p1Won = winnerId === this.player1.userId;
      const p2Won = winnerId === this.player2.userId;
      await Promise.all([
        UserRepository.updateStats(this.player1.userId, {
          matchesPlayed: 1,
          wins: p1Won ? 1 : 0,
          losses: p2Won ? 1 : 0,
        }),
        UserRepository.updateStats(this.player2.userId, {
          matchesPlayed: 1,
          wins: p2Won ? 1 : 0,
          losses: p1Won ? 1 : 0,
        }),
      ]);
    } catch (err) {
      console.error("[GameSession] Failed to finalize match:", err);
    }

    // Emit result
    this.io.to(this.roomId).emit("game_ended", {
      matchId: this.matchId,
      winner: winnerId,
      scores: { ...this.scores },
    });

    console.log(
      `[GameSession] Match ${this.matchId} ended. Winner: ${winnerId ?? "draw"}`
    );

    // ── On-chain settlement ───────────────────────────────────────────────────
    // Only the backend signer can settle. The SettlementService is idempotent
    // and guards against double settlement.
    if (this.escrowEnabled && SettlementService.enabled) {
      const winnerAddress = winnerId
        ? winnerId === this.player1.userId
          ? this.player1.walletAddress
          : this.player2.walletAddress
        : null;

      SettlementService.settle(this.matchId, winnerAddress)
        .then((result) => {
          this.io.to(this.roomId).emit("settlement_update", {
            matchId: this.matchId,
            status: result.status,
            txHash: result.txHash ?? null,
            reason: result.reason ?? null,
          });
        })
        .catch((err) => {
          console.error(`[GameSession] Settlement error for ${this.matchId}:`, err);
        });
    }
  }
}

module.exports = { GameSession };
