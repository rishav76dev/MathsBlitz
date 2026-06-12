/**
 * Minimal ABI for MathsBlitzEscrow — only the entries the backend needs.
 * Mirrors contract/src/MathsBlitzEscrow.sol (native CELO escrow).
 */
const ESCROW_ABI = [
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
    name: "cancelMatch",
    inputs: [{ name: "matchId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
];

/**
 * MatchStatus enum (matches the Solidity enum order).
 * @enum {number}
 */
const OnchainMatchStatus = {
  NonExistent: 0,
  Open: 1,
  Active: 2,
  Settled: 3,
  Cancelled: 4,
};

module.exports = { ESCROW_ABI, OnchainMatchStatus };
