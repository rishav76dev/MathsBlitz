/**
 * Minimal ABI for MathsBlitzEscrow — only the entries the backend needs.
 * Mirrors contract/src/MathsBlitzEscrow.sol (symmetric native-CELO escrow).
 */
const ESCROW_ABI = [
  // ── Views ──────────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "authorizedSigner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "treasury",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "paused",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getReservation",
    inputs: [{ name: "reservationId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "player", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "linked", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMatch",
    inputs: [{ name: "matchId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "player1", type: "address" },
          { name: "player2", type: "address" },
          { name: "wager", type: "uint256" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isSettlementUsed",
    inputs: [
      { name: "matchId", type: "bytes32" },
      { name: "winner", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "settlementDigest",
    inputs: [
      { name: "matchId", type: "bytes32" },
      { name: "winner", type: "address" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
  // ── Writes ─────────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "linkMatch",
    inputs: [
      { name: "matchId", type: "bytes32" },
      { name: "reservationA", type: "bytes32" },
      { name: "reservationB", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "settleMatch",
    inputs: [
      { name: "matchId", type: "bytes32" },
      { name: "winner", type: "address" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "serverWithdrawStake",
    inputs: [{ name: "reservationId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "refundDraw",
    inputs: [{ name: "matchId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "cancelMatch",
    inputs: [{ name: "matchId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
];

/**
 * MatchStatus enum — matches Solidity enum order.
 * Matches go directly NonExistent → Active (no Open step).
 * @enum {number}
 */
const OnchainMatchStatus = {
  NonExistent: 0,
  Active: 1,
  Settled: 2,
  Cancelled: 3,
};

module.exports = { ESCROW_ABI, OnchainMatchStatus };
