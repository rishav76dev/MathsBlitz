const jwt = require("jsonwebtoken");
const { UserRepository } = require("../repositories");

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const JWT_EXPIRY = process.env.JWT_EXPIRY || "7d";

// Allowed username format: 3–32 chars, letters/digits/underscore.
const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;

/**
 * GET /auth/profile?address=<walletAddress>
 * Upserts the user by wallet address and returns a fresh JWT + user object.
 */
async function getProfile(req, res) {
  try {
    const { address } = req.query;

    if (!address || typeof address !== "string") {
      return res.status(400).json({ error: "address query param is required" });
    }

    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return res.status(400).json({ error: "Invalid wallet address format" });
    }

    let user = await UserRepository.findByWallet(address);
    if (!user) {
      user = await UserRepository.create({ walletAddress: address });
    }

    const token = jwt.sign(
      {
        sub: user.walletAddress.toLowerCase(),
        userId: user._id.toString(),
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    return res.status(200).json({
      token,
      user: {
        id: user._id.toString(),
        walletAddress: user.walletAddress,
        username: user.username ?? null,
        wins: user.wins,
        losses: user.losses,
        matchesPlayed: user.matchesPlayed,
      },
    });
  } catch (err) {
    console.error("[Auth] getProfile error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /auth/username  (authenticated)
 * Body: { username: string }
 * Returns: { user: object }
 */
async function setUsername(req, res) {
  try {
    const raw = req.body?.username;
    if (typeof raw !== "string") {
      return res.status(400).json({ error: "username is required" });
    }

    const username = raw.trim();
    if (!USERNAME_RE.test(username)) {
      return res.status(400).json({
        error: "Username must be 3–32 characters: letters, numbers, or underscores.",
      });
    }

    const existing = await UserRepository.findByUsername(username);
    if (existing && existing._id.toString() !== req.userId) {
      return res.status(409).json({ error: "That username is already taken." });
    }

    const user = await UserRepository.setUsername(req.userId, username);
    if (!user) {
      return res.status(409).json({ error: "That username is already taken." });
    }

    return res.status(200).json({
      user: {
        id: user._id.toString(),
        walletAddress: user.walletAddress,
        username: user.username ?? null,
        wins: user.wins,
        losses: user.losses,
        matchesPlayed: user.matchesPlayed,
      },
    });
  } catch (err) {
    console.error("[Auth] setUsername error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = { getProfile, setUsername };
