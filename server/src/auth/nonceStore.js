/**
 * In-memory nonce store.
 * Stores a nonce per wallet address with a TTL of 5 minutes.
 * Replace with a Redis/MongoDB store for multi-instance deployments.
 */

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** @type {Map<string, { nonce: string, expiresAt: number }>} */
const store = new Map();

const NonceStore = {
  /**
   * Save a nonce for a wallet address.
   * @param {string} walletAddress - lowercase hex address
   * @param {string} nonce
   */
  set(walletAddress, nonce) {
    store.set(walletAddress.toLowerCase(), {
      nonce,
      expiresAt: Date.now() + NONCE_TTL_MS,
    });
  },

  /**
   * Retrieve and validate a stored nonce.
   * Returns null if not found or expired.
   * @param {string} walletAddress
   * @returns {string | null}
   */
  get(walletAddress) {
    const entry = store.get(walletAddress.toLowerCase());
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      store.delete(walletAddress.toLowerCase());
      return null;
    }
    return entry.nonce;
  },

  /**
   * Delete a nonce after it has been consumed.
   * @param {string} walletAddress
   */
  delete(walletAddress) {
    store.delete(walletAddress.toLowerCase());
  },
};

module.exports = { NonceStore };
