const {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  stringToHex,
  getAddress,
} = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { celo } = require("viem/chains");

/**
 * On-chain configuration for the MathsBlitz escrow.
 *
 * Escrow integration is *optional* in development: if the required env vars are
 * missing the backend runs in "escrow-disabled" mode — matches start without
 * staking and are not settled on-chain. This keeps the app runnable locally
 * without a deployed contract or funded signer.
 *
 * Required env vars to enable escrow:
 *   ESCROW_CONTRACT_ADDRESS  - deployed MathsBlitzEscrow address
 *   SETTLEMENT_PRIVATE_KEY   - private key of the authorised signer (0x-prefixed)
 *   CELO_RPC_URL             - RPC endpoint (defaults to Celo mainnet forno)
 */

// Celo mainnet only (chain 42220).
const CHAIN = celo;

const RPC_URL = process.env.CELO_RPC_URL || "https://forno.celo.org";

const CONTRACT_ADDRESS =
  process.env.ESCROW_CONTRACT_ADDRESS ||
  "0x7fe6844ed774d12ef6a4481f8df17cb698d07397";
const SETTLEMENT_PRIVATE_KEY = process.env.SETTLEMENT_PRIVATE_KEY || null;

const ESCROW_ENABLED = Boolean(CONTRACT_ADDRESS && SETTLEMENT_PRIVATE_KEY);

// ─── Lazily-built clients ──────────────────────────────────────────────────────
let _publicClient = null;
let _walletClient = null;
let _account = null;
let _walletTxQueue = Promise.resolve();

function getPublicClient() {
  if (!_publicClient) {
    _publicClient = createPublicClient({ chain: CHAIN, transport: http(RPC_URL) });
  }
  return _publicClient;
}

function getSettlementAccount() {
  if (!ESCROW_ENABLED) return null;
  if (!_account) {
    const pk = SETTLEMENT_PRIVATE_KEY.startsWith("0x")
      ? SETTLEMENT_PRIVATE_KEY
      : `0x${SETTLEMENT_PRIVATE_KEY}`;
    _account = privateKeyToAccount(pk);
  }
  return _account;
}

function getWalletClient() {
  if (!ESCROW_ENABLED) return null;
  if (!_walletClient) {
    _walletClient = createWalletClient({
      account: getSettlementAccount(),
      chain: CHAIN,
      transport: http(RPC_URL),
    });
  }
  return _walletClient;
}

/**
 * Serialize all transactions sent from the server wallet.
 *
 * The backend uses one signer for match linking, settlement, and queue
 * withdrawals. Those writes must not race each other, or nonce assignment can
 * collide when multiple matches settle at once.
 *
 * @template T
 * @param {() => Promise<T>} task
 * @returns {Promise<T>}
 */
function runWalletTransaction(task) {
  const next = _walletTxQueue.then(task, task);
  _walletTxQueue = next.catch(() => {});
  return next;
}

/**
 * Derive the deterministic on-chain matchId (bytes32) from the DB match id.
 * @param {string} dbMatchId - Mongo ObjectId string
 * @returns {`0x${string}`}
 */
function deriveOnchainMatchId(dbMatchId) {
  return keccak256(stringToHex(`mathsblitz:${dbMatchId}`));
}

/**
 * Derive a unique reservation ID for a player's pre-queue stake.
 * @param {string} userId - server-side user id
 * @param {number} timestamp - Date.now() at reservation creation
 * @returns {`0x${string}`}
 */
function deriveReservationId(userId, timestamp) {
  return keccak256(stringToHex(`mathsblitz:reservation:${userId}:${timestamp}`));
}

/**
 * Convert a wager amount (in CELO, e.g. 0.5) to wei as a bigint.
 * Avoids floating-point drift by working in integer milli-CELO.
 * @param {number} celoAmount
 * @returns {bigint}
 */
function wagerToWei(celoAmount) {
  const milli = Math.round(Number(celoAmount) * 1000);
  return (BigInt(milli) * 10n ** 18n) / 1000n;
}

module.exports = {
  CHAIN,
  RPC_URL,
  CONTRACT_ADDRESS: CONTRACT_ADDRESS ? getAddress(CONTRACT_ADDRESS) : null,
  ESCROW_ENABLED,
  getPublicClient,
  getWalletClient,
  runWalletTransaction,
  getSettlementAccount,
  deriveOnchainMatchId,
  deriveReservationId,
  wagerToWei,
};
