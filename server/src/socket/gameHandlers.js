const { QueueManager } = require("../game/QueueManager");
const { gameSessionManager } = require("../game/GameSessionManager");

/**
 * Register all game-related socket event handlers on an authenticated socket.
 *
 * @param {import("socket.io").Socket} socket
 * @param {import("socket.io").Server} io
 */
function registerGameHandlers(socket, io) {
  const { userId, walletAddress } = socket;

  // ── join_queue ────────────────────────────────────────────────────────────
  socket.on("join_queue", ({ wager } = {}) => {
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
    QueueManager.dequeue(userId, io);
  });

  // ── confirm_stake ─────────────────────────────────────────────────────────
  // Client reports its escrow stake tx has confirmed; server verifies on-chain.
  socket.on("confirm_stake", ({ matchId } = {}) => {
    if (!matchId) return;
    gameSessionManager.handleStakeConfirmation(userId, matchId, io);
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

  // ── disconnect ────────────────────────────────────────────────────────────
  socket.on("disconnect", (reason) => {
    console.log(`[Socket] ${userId} disconnected: ${reason}`);
    QueueManager.dequeue(userId, io);
    gameSessionManager.handleDisconnect(userId);
  });
}

module.exports = { registerGameHandlers };
