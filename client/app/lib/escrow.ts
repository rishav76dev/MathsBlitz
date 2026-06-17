import {
  createPublicClient,
  http,
  encodeFunctionData,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { celo, celoSepolia } from "viem/chains";

/**
 * Client-side configuration + helpers for the MathsBlitzEscrow contract.
 *
 * Symmetric flow: both players depositStake before matchmaking, then the
 * server calls linkMatch once opponents are found.
 *
 * TODO: migrate to Celo mainnet before production.
 * To switch: set NEXT_PUBLIC_CELO_NETWORK=mainnet and redeploy the contract.
 */

// Currently on Celo Sepolia testnet (chain 11142220).
const NETWORK = (process.env.NEXT_PUBLIC_CELO_NETWORK || "sepolia").toLowerCase();
export const ESCROW_CHAIN = NETWORK === "mainnet" ? celo : celoSepolia;

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

const RPC_URLS: Record<number, string> = {
  [celo.id]: "https://forno.celo.org",
  [celoSepolia.id]: "https://forno.celo-sepolia.celo-testnet.org",
};

/** A read-only viem client for the configured Celo network (waits on receipts). */
export function getPublicClient(chainId?: number) {
  const chain =
    chainId === celo.id ? celo :
    chainId === celoSepolia.id ? celoSepolia :
    ESCROW_CHAIN;
  return createPublicClient({ chain, transport: http(RPC_URLS[chain.id]) });
}

export type { Address, Hex };
