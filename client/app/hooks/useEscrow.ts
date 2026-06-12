"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toHex } from "viem";
import { useSocket } from "./useSocket";
import { useWallet } from "./useWallet";
import { useMiniPay } from "./useMiniPay";
import {
  encodeStakeCall,
  encodeCancelCall,
  wagerToWei,
  getPublicClient,
} from "../lib/escrow";
import type { MatchFoundPayload } from "../lib/gameTypes";

/**
 * Escrow staking lifecycle for a matched game.
 *
 *  creator: ready_to_stake → staking → waiting_opponent → ready
 *  joiner:  awaiting_creator → ready_to_stake → staking → confirming → ready
 *
 * `ready` means both stakes are confirmed on-chain and the server has released
 * the game — the page should navigate to the match.
 */
export type EscrowPhase =
  | "awaiting_creator"
  | "ready_to_stake"
  | "staking"
  | "confirming"
  | "waiting_opponent"
  | "ready"
  | "expired"
  | "error";

export interface UseEscrowReturn {
  phase: EscrowPhase;
  txHash: `0x${string}` | null;
  error: string | null;
  /** Submit the role-appropriate stake transaction (createMatch / joinMatch). */
  stake: () => Promise<void>;
  /** Creator-only: reclaim an unmatched stake after expiry (cancelMatch). */
  cancelStake: () => Promise<void>;
}

export function useEscrow(match: MatchFoundPayload | null): UseEscrowReturn {
  const { socket } = useSocket();
  const { address } = useWallet();
  const { provider } = useMiniPay();

  const isCreator = match?.role === "creator";

  // State resets naturally per match: the parent renders WagerStaking with a
  // `key={match.matchId}`, so this hook remounts for each new match.
  const [phase, setPhase] = useState<EscrowPhase>(
    isCreator ? "ready_to_stake" : "awaiting_creator"
  );
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Server escrow events ───────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !match) return;

    const onUpdate = (p: { matchId: string; escrowStatus: string }) => {
      if (p.matchId !== match.matchId) return;
      // Creator has staked — the joiner may now stake.
      if (p.escrowStatus === "open" && !isCreator) {
        setPhase((cur) => (cur === "awaiting_creator" ? "ready_to_stake" : cur));
      }
    };
    const onReady = (p: { matchId: string }) => {
      if (p.matchId === match.matchId) setPhase("ready");
    };
    const onExpired = (p: { matchId: string }) => {
      if (p.matchId === match.matchId) setPhase("expired");
    };
    const onError = (p: { matchId: string; message: string }) => {
      if (p.matchId !== match.matchId) return;
      setError(p.message);
      // Allow a retry from a stakeable state.
      setPhase(isCreator ? "ready_to_stake" : "ready_to_stake");
    };

    socket.on("escrow_update", onUpdate);
    socket.on("escrow_ready", onReady);
    socket.on("escrow_expired", onExpired);
    socket.on("escrow_error", onError);
    return () => {
      socket.off("escrow_update", onUpdate);
      socket.off("escrow_ready", onReady);
      socket.off("escrow_expired", onExpired);
      socket.off("escrow_error", onError);
    };
  }, [socket, match, isCreator]);

  // Guard against double-submits.
  const submitting = useRef(false);

  // ── Stake action ────────────────────────────────────────────────────────────
  const stake = useCallback(async () => {
    if (!match || !match.escrowEnabled || !match.onchainMatchId || !match.contractAddress) return;
    if (!provider || !address) {
      setError("Wallet not connected.");
      return;
    }
    if (submitting.current || phase !== "ready_to_stake") return;

    submitting.current = true;
    setError(null);
    setPhase("staking");

    try {
      const data = encodeStakeCall(
        isCreator ? "createMatch" : "joinMatch",
        match.onchainMatchId
      );
      const value = toHex(wagerToWei(match.wager));

      const hash = (await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: address, to: match.contractAddress, value, data }],
      })) as `0x${string}`;

      setTxHash(hash);
      setPhase("confirming");

      // Wait until the stake is mined before telling the server.
      await getPublicClient(match.chainId ?? undefined).waitForTransactionReceipt({ hash });

      // The creator now waits for the opponent; the joiner waits for the server
      // to verify the now-Active match and release the game.
      setPhase(isCreator ? "waiting_opponent" : "confirming");
      socket?.emit("confirm_stake", { matchId: match.matchId });
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      const msg =
        code === 4001
          ? "Transaction rejected in wallet."
          : (err as Error)?.message || "Staking transaction failed.";
      setError(msg);
      setPhase("ready_to_stake");
    } finally {
      submitting.current = false;
    }
  }, [match, provider, address, isCreator, phase, socket]);

  // ── Cancel (creator reclaiming an unmatched stake after expiry) ──────────────
  const cancelStake = useCallback(async () => {
    if (!match?.onchainMatchId || !match.contractAddress || !provider || !address) return;
    try {
      const data = encodeCancelCall(match.onchainMatchId);
      const hash = (await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: address, to: match.contractAddress, data }],
      })) as `0x${string}`;
      setTxHash(hash);
      await getPublicClient(match.chainId ?? undefined).waitForTransactionReceipt({ hash });
    } catch (err: unknown) {
      setError((err as Error)?.message || "Cancel failed.");
    }
  }, [match, provider, address]);

  return { phase, txHash, error, stake, cancelStake };
}
