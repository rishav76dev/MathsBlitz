const { gameSessionManager } = require("./GameSessionManager");

const VALID_WAGERS = [0.01];

/**
 * In-memory matchmaking queue.
 * One queue array per wager tier.
 *
 * @type {Map<number, Array<{ userId: string, socketId: string, walletAddress: string, reservationId: string, joinedAt: number }>>}
 */
const queues = new Map(VALID_WAGERS.map((w) => [w, []]));

/**
 * @type {Map<string, number>} userId → wager (for fast dequeue)
 */
const playerWagerIndex = new Map();

const QueueManager = {
  /**
   * Add a pre-staked player to the matchmaking queue.
   * Called by GameSessionManager after on-chain reservation is verified.
   * Returns false if the wager is invalid or the player is already queued.
   *
   * @param {{ userId: string, socketId: string, walletAddress: string, reservationId: string }} player
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

    console.log(
      `[Queue] ${player.userId} joined ${wager} CELO queue (depth: ${queue.length})`
    );

    // Try to form a match immediately
    this._tryMatch(wager, io);
    return true;
  },

  /**
   * Remove a player from the queue.
   * Returns the removed queue entry (including reservationId) or null if not found.
   * @param {string} userId
   * @param {import("socket.io").Server} io
   * @returns {{ userId: string, socketId: string, walletAddress: string, reservationId: string, joinedAt: number } | null}
   */
  dequeue(userId, io) {
    const wager = playerWagerIndex.get(userId);
    if (wager === undefined) return null;

    const queue = queues.get(wager);
    const idx = queue.findIndex((e) => e.userId === userId);
    const entry = idx !== -1 ? queue[idx] : null;
    if (idx !== -1) queue.splice(idx, 1);
    playerWagerIndex.delete(userId);

    // Notify the player
    const allSockets = io.sockets.sockets;
    for (const [, s] of allSockets) {
      if (s.userId === userId) {
        s.emit("queue_left", {});
        break;
      }
    }

    const display = entry?.walletAddress
      ? `${entry.walletAddress.slice(0, 6)}…${entry.walletAddress.slice(-4)}`
      : userId;
    console.log(`[Queue] ${display} left ${wager} CELO queue`);
    return entry;
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
