require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server: SocketIOServer } = require("socket.io");

const { connectDB } = require("./src/db/connection");
const { authRouter } = require("./src/auth/authRouter");
const { initSocketServer } = require("./src/socket/socketServer");

const PORT = process.env.PORT || 4000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

async function main() {
  await connectDB();

  const app = express();

  // ── Middleware ─────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: CLIENT_URL,
      credentials: true,
    })
  );
  app.use(express.json());

  // ── HTTP Routes ────────────────────────────────────────────────────────────
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/auth", authRouter);
  app.use((_req, res) => res.status(404).json({ error: "Not found" }));

  // ── HTTP Server ────────────────────────────────────────────────────────────
  const httpServer = http.createServer(app);

  // ── Socket.IO ─────────────────────────────────────────────────────────────
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: CLIENT_URL,
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Allow reconnection within the match window
    connectionStateRecovery: {
      maxDisconnectionDuration: 30_000, // 30 seconds
    },
  });

  initSocketServer(io);

  // ── Start ──────────────────────────────────────────────────────────────────
  httpServer.listen(PORT, () => {
    console.log(`[Server] MathsBlitz API + WS listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
