const { gameSessionManager } = require("./GameSessionManager");

const VALID_WAGERS = [0.01];

/**
 * In-memory matchmaking queue.
 * One queue array per wager tier.
 *
 * @type {Map<number, Array<{ userId: string, socketId: string, walletAddress: string, joinedAt: number }>>}
 */
const queues = new Map(VALID_WAGERS.map((w) => [w, []]));

/**
 * @type {Map<string, number>} userId → wager (for fast dequeue)
 */
const playerWagerIndex = new Map();

const QueueManager = {
  /**
   * Add a player to the matchmaking queue.
   * Returns false if the wager is invalid or the player is already queued.
   *
   * @param {{ userId: string, socketId: string, walletAddress: string }} player
   * @param {number} wager
   * @param {import("socket.io").Server} io
   * @returns {boolean}
   */
  enqueue(player, wager, io) {
    if (!VALID_WAGERS.includes(wager)) return false;
    if (playerWagerIndex.has(player.userId)) return false; // already queued

    const queue = queues.get(wager);
    queue.push({ ...player, joinedAt: Date.now() });
    playerWagerIndex.set(player.userId, wager);

    // Notify the player they're in the queue
    const socket = io.sockets.sockets.get(player.socketId);
    if (socket) socket.emit("queue_joined", { wager });

    console.log(
      `[Queue] ${player.userId} joined ${wager} CELO queue (depth: ${queue.length})`
    );

    // Try to form a match immediately
    this._tryMatch(wager, io);
    return true;
  },

  /**
   * Remove a player from the queue.
   * @param {string} userId
   * @param {import("socket.io").Server} io
   */
  dequeue(userId, io) {
    const wager = playerWagerIndex.get(userId);
    if (wager === undefined) return;

    const queue = queues.get(wager);
    const idx = queue.findIndex((e) => e.userId === userId);
    if (idx !== -1) queue.splice(idx, 1);
    playerWagerIndex.delete(userId);

    // Notify the player
    const socket = io.sockets.sockets.get(
      queue[idx]?.socketId ?? "" // may already be gone
    );
    // Find socket directly
    const allSockets = io.sockets.sockets;
    for (const [, s] of allSockets) {
      if (s.userId === userId) {
        s.emit("queue_left", {});
        break;
      }
    }

    console.log(`[Queue] ${userId} left ${wager} CELO queue`);
  },

  /**
   * Check if two players can be matched on a given wager tier.
   * @param {number} wager
   * @param {import("socket.io").Server} io
   */
  async _tryMatch(wager, io) {
    const queue = queues.get(wager);
    if (queue.length < 2) return;

    const player1 = queue.shift();
    const player2 = queue.shift();

    playerWagerIndex.delete(player1.userId);
    playerWagerIndex.delete(player2.userId);

    console.log(
      `[Queue] Matched ${player1.userId} vs ${player2.userId} at ${wager} CELO`
    );

    try {
      await gameSessionManager.createSession(player1, player2, wager, io);
    } catch (err) {
      console.error("[Queue] Failed to create session:", err);
      // Re-queue both players on failure
      queue.unshift(player1, player2);
      playerWagerIndex.set(player1.userId, wager);
      playerWagerIndex.set(player2.userId, wager);
    }
  },

  /**
   * Check if a userId is currently queued.
   * @param {string} userId
   * @returns {boolean}
   */
  isQueued(userId) {
    return playerWagerIndex.has(userId);
  },
};

module.exports = { QueueManager, VALID_WAGERS };
