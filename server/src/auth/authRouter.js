const { Router } = require("express");
const { getProfile, setUsername } = require("./authController");
const { requireAuth } = require("./authMiddleware");

const authRouter = Router();

// GET /auth/profile?address= — upsert user by wallet, return JWT (wallet-only auth)
authRouter.get("/profile", getProfile);

// POST /auth/username — set/update the authenticated user's username
authRouter.post("/username", requireAuth, setUsername);

module.exports = { authRouter };
