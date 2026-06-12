import {
  createPublicClient,
  http,
  encodeFunctionData,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { celo, celoAlfajores } from "viem/chains";

/**
 * Client-side configuration + helpers for the MathsBlitzEscrow contract.
 *
 * The contract address and network are provided by the server in the
 * `match_found` payload, so the only build-time config needed is whether
 * escrow is enabled (derived from the server payload at runtime).
 */

const NETWORK = (process.env.NEXT_PUBLIC_CELO_NETWORK || "alfajores").toLowerCase();
export const ESCROW_CHAIN = NETWORK === "mainnet" ? celo : celoAlfajores;

// Minimal ABI — only the entries the client calls.
export const ESCROW_ABI = [
  {
    type: "function",
    name: "createMatch",
    inputs: [{ name: "matchId", type: "bytes32" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "joinMatch",
    inputs: [{ name: "matchId", type: "bytes32" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "cancelMatch",
    inputs: [{ name: "matchId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
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
] as const;

/** Convert a CELO wager (e.g. 0.5) to wei. */
export function wagerToWei(celoAmount: number): bigint {
  return parseUnits(String(celoAmount), 18);
}

/** Encode calldata for createMatch / joinMatch. */
export function encodeStakeCall(
  fn: "createMatch" | "joinMatch",
  onchainMatchId: Hex
): Hex {
  return encodeFunctionData({ abi: ESCROW_ABI, functionName: fn, args: [onchainMatchId] });
}

/** Encode calldata for cancelMatch (creator reclaiming an unmatched stake). */
export function encodeCancelCall(onchainMatchId: Hex): Hex {
  return encodeFunctionData({ abi: ESCROW_ABI, functionName: "cancelMatch", args: [onchainMatchId] });
}

/** A read-only viem client for the configured Celo network (waits on receipts). */
export function getPublicClient(chainId?: number) {
  const chain = chainId === celo.id ? celo : chainId === celoAlfajores.id ? celoAlfajores : ESCROW_CHAIN;
  return createPublicClient({ chain, transport: http() });
}

export type { Address, Hex };
