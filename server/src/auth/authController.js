const crypto = require("crypto");
const { verifyMessage } = require("viem");
const jwt = require("jsonwebtoken");
const { NonceStore } = require("./nonceStore");
const { UserRepository } = require("../repositories");

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const JWT_EXPIRY = process.env.JWT_EXPIRY || "7d";

// The message template the client must sign.
// Using a human-readable prefix improves UX inside MiniPay's signing prompt.
function buildSignMessage(walletAddress, nonce) {
  return (
    `Welcome to MathsBlitz!\n\n` +
    `Sign this message to verify ownership of your wallet.\n\n` +
    `Wallet: ${walletAddress.toLowerCase()}\n` +
    `Nonce: ${nonce}`
  );
}

/**
 * POST /auth/nonce
 * Body: { walletAddress: string }
 * Returns: { nonce: string, message: string }
 */
async function requestNonce(req, res) {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress || typeof walletAddress !== "string") {
      return res.status(400).json({ error: "walletAddress is required" });
    }

    // Basic EVM address validation
    if (!/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      return res.status(400).json({ error: "Invalid wallet address format" });
    }

    const nonce = crypto.randomBytes(32).toString("hex");
    NonceStore.set(walletAddress, nonce);

    const message = buildSignMessage(walletAddress, nonce);

    return res.status(200).json({ nonce, message });
  } catch (err) {
    console.error("[Auth] requestNonce error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /auth/verify
 * Body: { walletAddress: string, signature: string }
 * Returns: { token: string, user: object, isNewUser: boolean }
 */
async function verifySignature(req, res) {
  try {
    const { walletAddress, signature } = req.body;

    if (!walletAddress || !signature) {
      return res
        .status(400)
        .json({ error: "walletAddress and signature are required" });
    }

    if (!/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      return res.status(400).json({ error: "Invalid wallet address format" });
    }

    // Retrieve stored nonce
    const nonce = NonceStore.get(walletAddress);
    if (!nonce) {
      return res.status(401).json({
        error: "Nonce not found or expired. Please request a new nonce.",
      });
    }

    const message = buildSignMessage(walletAddress, nonce);

    // Verify the signature using viem
    let isValid = false;
    try {
      isValid = await verifyMessage({
        address: walletAddress,
        message,
        signature,
      });
    } catch {
      return res.status(401).json({ error: "Signature verification failed" });
    }

    if (!isValid) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    // Consume the nonce — one-time use
    NonceStore.delete(walletAddress);

    // Upsert user
    let user = await UserRepository.findByWallet(walletAddress);
    let isNewUser = false;

    if (!user) {
      user = await UserRepository.create({ walletAddress });
      isNewUser = true;
    }

    // Issue JWT
    const token = jwt.sign(
      {
        sub: walletAddress.toLowerCase(),
        userId: user._id.toString(),
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    return res.status(200).json({
      token,
      isNewUser,
      user: {
        id: user._id.toString(),
        walletAddress: user.walletAddress,
        username: user.username ?? null,
        elo: user.elo,
        wins: user.wins,
        losses: user.losses,
        matchesPlayed: user.matchesPlayed,
      },
    });
  } catch (err) {
    console.error("[Auth] verifySignature error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// Allowed username format: 3–32 chars, letters/digits/underscore.
const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;

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

    // Reject if the name is taken by another user.
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
        elo: user.elo,
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

module.exports = { requestNonce, verifySignature, setUsername };
