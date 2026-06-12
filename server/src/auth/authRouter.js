const { Router } = require("express");
const { requestNonce, verifySignature, setUsername } = require("./authController");
const { requireAuth } = require("./authMiddleware");

const authRouter = Router();

// POST /auth/nonce — request a sign challenge for a wallet
authRouter.post("/nonce", requestNonce);

// POST /auth/verify — submit signed nonce, receive JWT
authRouter.post("/verify", verifySignature);

// POST /auth/username — set/update the authenticated user's username
authRouter.post("/username", requireAuth, setUsername);

module.exports = { authRouter };
