import {
  createPublicClient,
  http,
  encodeFunctionData,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { celo } from "viem/chains";

/**
 * Client-side configuration + helpers for the MathsBlitzEscrow contract.
 *
 * Symmetric flow: both players depositStake before matchmaking, then the
 * server calls linkMatch once opponents are found.
 */

// Celo mainnet only (chain 42220).
export const ESCROW_CHAIN = celo;

// Minimal ABI — only the entries the client calls.
export const ESCROW_ABI = [
  {
    type: "function",
    name: "depositStake",
    inputs: [{ name: "reservationId", type: "bytes32" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "withdrawStake",
    inputs: [{ name: "reservationId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

/** Convert a CELO wager (e.g. 0.01) to wei. */
export function wagerToWei(celoAmount: number): bigint {
  return parseUnits(String(celoAmount), 18);
}

/** Encode calldata for depositStake(reservationId). */
export function encodeDepositStake(reservationId: Hex): Hex {
  return encodeFunctionData({ abi: ESCROW_ABI, functionName: "depositStake", args: [reservationId] });
}

/** Encode calldata for withdrawStake(reservationId) — reclaim stake while in queue. */
export function encodeWithdrawStake(reservationId: Hex): Hex {
  return encodeFunctionData({ abi: ESCROW_ABI, functionName: "withdrawStake", args: [reservationId] });
}

/** A read-only viem client for Celo mainnet (waits on receipts). */
export function getPublicClient() {
  return createPublicClient({ chain: celo, transport: http("https://forno.celo.org") });
}

export type { Address, Hex };
