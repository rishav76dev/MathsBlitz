const {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  stringToHex,
  getAddress,
} = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { celo, celoAlfajores } = require("viem/chains");

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
 *   CELO_RPC_URL             - RPC endpoint (defaults to Alfajores forno)
 *   CELO_NETWORK             - "mainnet" | "alfajores" (default "alfajores")
 */

const NETWORK = (process.env.CELO_NETWORK || "alfajores").toLowerCase();
const CHAIN = NETWORK === "mainnet" ? celo : celoAlfajores;

const RPC_URL =
  process.env.CELO_RPC_URL ||
  (NETWORK === "mainnet"
    ? "https://forno.celo.org"
    : "https://alfajores-forno.celo-testnet.org");

const CONTRACT_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS || null;
const SETTLEMENT_PRIVATE_KEY = process.env.SETTLEMENT_PRIVATE_KEY || null;

const ESCROW_ENABLED = Boolean(CONTRACT_ADDRESS && SETTLEMENT_PRIVATE_KEY);

// ─── Lazily-built clients ──────────────────────────────────────────────────────
let _publicClient = null;
let _walletClient = null;
let _account = null;

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
 * Derive the deterministic on-chain matchId (bytes32) from the DB match id.
 * Both client and server must agree — the server is the source of truth and
 * sends this value to clients in `match_found`.
 *
 * @param {string} dbMatchId - Mongo ObjectId string
 * @returns {`0x${string}`}
 */
function deriveOnchainMatchId(dbMatchId) {
  return keccak256(stringToHex(`mathsblitz:${dbMatchId}`));
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
  NETWORK,
  CONTRACT_ADDRESS: CONTRACT_ADDRESS ? getAddress(CONTRACT_ADDRESS) : null,
  ESCROW_ENABLED,
  getPublicClient,
  getWalletClient,
  getSettlementAccount,
  deriveOnchainMatchId,
  wagerToWei,
};
