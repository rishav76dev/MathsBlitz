const jwt = require("jsonwebtoken");
const { registerGameHandlers } = require("./gameHandlers");

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";

/** @type {Map<string, string>} userId → socketId (user presence) */
const presenceMap = new Map();

/**
 * Initialise the Socket.IO server — attaches JWT auth middleware,
 * user presence tracking, and game event handlers.
 *
 * @param {import("socket.io").Server} io
 */
function initSocketServer(io) {
  // ── JWT auth middleware ──────────────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication token missing"));

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      // Attach identity to the socket for use in handlers
      socket.userId = payload.userId;
      socket.walletAddress = payload.sub; // lowercase wallet address
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  // ── Connection handler ───────────────────────────────────────────────────
  io.on("connection", (socket) => {
    const { userId, walletAddress } = socket;
    console.log(`[Socket] ${walletAddress} connected (${socket.id})`);

    // Update presence
    presenceMap.set(userId, socket.id);

    // Register game-specific handlers
    registerGameHandlers(socket, io);

    // Remove from presence on disconnect (also handled in gameHandlers)
    socket.on("disconnect", () => {
      if (presenceMap.get(userId) === socket.id) {
        presenceMap.delete(userId);
      }
    });
  });

  console.log("[Socket.IO] Server initialised");
}

/**
 * Get the socket ID for a connected user, or undefined if offline.
 * @param {string} userId
 * @returns {string | undefined}
 */
function getSocketId(userId) {
  return presenceMap.get(userId);
}

module.exports = { initSocketServer, getSocketId };
