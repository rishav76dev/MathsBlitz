const { QueueManager, VALID_WAGERS } = require("../game/QueueManager");
const { gameSessionManager } = require("../game/GameSessionManager");
const {
  ESCROW_ENABLED,
  CONTRACT_ADDRESS,
  getWalletClient,
} = require("../chain/config");
const { ESCROW_ABI } = require("../chain/escrowAbi");

/**
 * If escrow is enabled and the dequeued entry has a reservationId, call
 * serverWithdrawStake on-chain so the player's stake is returned without
 * requiring a second user-signed transaction.
 * Fire-and-forget — the player is already removed from the queue.
 * @param {{ reservationId?: string, walletAddress?: string } | null} entry
 */
function _serverWithdrawIfNeeded(entry) {
  if (!ESCROW_ENABLED || !entry?.reservationId) return;
  getWalletClient()
    .writeContract({
      address: CONTRACT_ADDRESS,
      abi: ESCROW_ABI,
      functionName: "serverWithdrawStake",
      args: [entry.reservationId],
    })
    .then((txHash) => {
      console.log(
        `[Escrow] serverWithdrawStake submitted for ${entry.reservationId} (tx: ${txHash})`
      );
    })
    .catch((err) => {
      console.error(
        `[Escrow] serverWithdrawStake failed for ${entry.reservationId}:`,
        err.shortMessage || err.message
      );
    });
}

/**
 * Register all game-related socket event handlers on an authenticated socket.
 *
 * @param {import("socket.io").Socket} socket
 * @param {import("socket.io").Server} io
 */
function registerGameHandlers(socket, io) {
  const { userId, walletAddress } = socket;

  // ── stake_and_queue (escrow-enabled path) ─────────────────────────────────
  // Client requests a reservation ID so it can depositStake on-chain before
  // entering the queue. After the tx confirms, client emits confirm_stake.
  socket.on("stake_and_queue", ({ wager } = {}) => {
    const wagerNum = Number(wager);
    if (!VALID_WAGERS.includes(wagerNum)) {
      socket.emit("error_event", { message: "Invalid wager amount." });
      return;
    }
    if (QueueManager.isQueued(userId)) {
      socket.emit("error_event", { message: "Already in queue." });
      return;
    }
    gameSessionManager.createReservation(
      { userId, socketId: socket.id, walletAddress },
      wagerNum,
      io
    );
  });

  // ── join_queue (escrow-disabled path) ─────────────────────────────────────
  // When escrow is off, players join the queue directly without staking.
  socket.on("join_queue", ({ wager } = {}) => {
    if (ESCROW_ENABLED) {
      // Redirect: escrow is on, use stake_and_queue instead.
      socket.emit("error_event", { message: "Use stake_and_queue when escrow is enabled." });
      return;
    }
    const wagerNum = Number(wager);
    const ok = QueueManager.enqueue(
      { userId, socketId: socket.id, walletAddress },
      wagerNum,
      io
    );
    if (!ok) {
      socket.emit("error_event", { message: "Invalid wager or already in queue." });
    }
  });

  // ── leave_queue ───────────────────────────────────────────────────────────
  socket.on("leave_queue", () => {
    const entry = QueueManager.dequeue(userId, io);
    _serverWithdrawIfNeeded(entry);
  });

  // ── confirm_stake ─────────────────────────────────────────────────────────
  // Client reports its depositStake tx has confirmed. Server verifies on-chain,
  // then adds the player to the matchmaking queue.
  socket.on("confirm_stake", ({ reservationId } = {}) => {
    if (!reservationId) return;
    gameSessionManager.handleStakeConfirmation(userId, reservationId, io);
  });

  // ── submit_answer ─────────────────────────────────────────────────────────
  socket.on("submit_answer", ({ matchId, questionId, answer } = {}) => {
    if (!matchId || !questionId || answer === undefined) return;

    const session = gameSessionManager.getSession(matchId);
    if (!session) {
      socket.emit("error_event", { message: "Match not found." });
      return;
    }

    session.handleAnswer(userId, questionId, Number(answer));
  });

  // ── skip_question ─────────────────────────────────────────────────────────
  socket.on("skip_question", ({ matchId, questionId } = {}) => {
    if (!matchId || !questionId) return;
    const session = gameSessionManager.getSession(matchId);
    if (!session) return;
    session.handleSkip(userId, questionId);
  });

  // ── disconnect ────────────────────────────────────────────────────────────
  socket.on("disconnect", (reason) => {
    console.log(`[Socket] ${userId} disconnected: ${reason}`);
    const entry = QueueManager.dequeue(userId, io);
    _serverWithdrawIfNeeded(entry);
    gameSessionManager.handleDisconnect(userId);
  });
}

module.exports = { registerGameHandlers };
