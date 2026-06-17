"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toHex } from "viem";
import { useSendTransaction } from "wagmi";
import { useSocket } from "./useSocket";
import { useWallet } from "./useWallet";
import { useMiniPay } from "./useMiniPay";
import {
  encodeDepositStake,
  wagerToWei,
  getPublicClient,
} from "../lib/escrow";
import type { ReservationReadyPayload, WagerAmount } from "../lib/gameTypes";

/**
 * Pre-queue staking lifecycle.
 *
 * State machine:
 *   idle → requesting → ready_to_stake → staking → confirming → queued
 *                                                                  ↓
 *                                               withdrawing ← (leave queue)
 *                                                   ↓
 *                                               withdrawn
 *
 * `queued` means the stake is confirmed on-chain and the player is in the
 * matchmaking queue. The parent listens for match_found to navigate.
 */
export type EscrowPhase =
  | "idle"
  | "requesting"
  | "ready_to_stake"
  | "staking"
  | "confirming"
  | "queued"
  | "withdrawing"
  | "withdrawn"
  | "error";

export interface UseEscrowReturn {
  phase: EscrowPhase;
  txHash: `0x${string}` | null;
  error: string | null;
  /** Deposit the wager on-chain. Only valid in ready_to_stake phase. */
  stake: () => Promise<void>;
  /** Signal the server to leave the queue and reclaim stake. Valid in queued phase. */
  withdraw: () => void;
}

export function useEscrow(wager: WagerAmount | null): UseEscrowReturn {
  const { socket } = useSocket();
  const { address } = useWallet();
  const { provider } = useMiniPay();
  const { sendTransactionAsync } = useSendTransaction();

  const [phase, setPhase] = useState<EscrowPhase>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reservation, setReservation] = useState<ReservationReadyPayload | null>(null);
  // Ref mirrors phase so callbacks can read the current phase without being
  // recreated on every phase change.
  const phaseRef = useRef<EscrowPhase>("idle");
  const submitting = useRef(false);

  const setTrackedPhase = useCallback(
    (next: EscrowPhase | ((prev: EscrowPhase) => EscrowPhase)) => {
      setPhase((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        phaseRef.current = resolved;
        return resolved;
      });
    },
    []
  );

  // ── Emit stake_and_queue when wager is set ─────────────────────────────────
  useEffect(() => {
    if (!socket || !wager) return;
    setTrackedPhase("requesting");
    setError(null);
    setReservation(null);
    setTxHash(null);
    socket.emit("stake_and_queue", { wager });
  }, [socket, wager, setTrackedPhase]);

  // ── Server events ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onReservationReady = (payload: ReservationReadyPayload) => {
      // Guard: a socket reconnect can replay stake_and_queue → reservation_ready
      // while the user is already in staking/confirming. Ignore those.
      setTrackedPhase((prev) => {
        if (prev !== "requesting") return prev;
        setReservation(payload);
        return "ready_to_stake";
      });
    };

    const onQueueJoined = () => {
      setTrackedPhase("queued");
    };

    const onQueueLeft = () => {
      // Only advance to withdrawn if we explicitly requested withdrawal.
      setTrackedPhase((prev) => (prev === "withdrawing" ? "withdrawn" : prev));
    };

    const onEscrowError = (payload: { message: string }) => {
      setError(payload.message);
      setTrackedPhase("error");
    };

    socket.on("reservation_ready", onReservationReady);
    socket.on("queue_joined", onQueueJoined);
    socket.on("queue_left", onQueueLeft);
    socket.on("escrow_error", onEscrowError);

    return () => {
      socket.off("reservation_ready", onReservationReady);
      socket.off("queue_joined", onQueueJoined);
      socket.off("queue_left", onQueueLeft);
      socket.off("escrow_error", onEscrowError);
    };
  }, [socket, setTrackedPhase]);

  // ── Stake ──────────────────────────────────────────────────────────────────
  const stake = useCallback(async () => {
    if (!reservation || phaseRef.current !== "ready_to_stake") return;
    if (!address) { setError("Wallet not connected."); return; }
    if (submitting.current) return;

    submitting.current = true;
    setError(null);
    setTrackedPhase("staking");

    try {
      const data = encodeDepositStake(reservation.reservationId);
      const value = wagerToWei(reservation.wager);
      const to = reservation.contractAddress;

      let hash: `0x${string}`;
      if (provider) {
        // MiniPay in-app browser — raw EIP-1193 provider.
        hash = (await provider.request({
          method: "eth_sendTransaction",
          params: [{ from: address, to, value: toHex(value), data }],
        })) as `0x${string}`;
      } else {
        // Regular browser wallet (MetaMask, etc.) via wagmi.
        hash = await sendTransactionAsync({ to, value, data });
      }

      setTxHash(hash);
      setTrackedPhase("confirming");

      await getPublicClient().waitForTransactionReceipt({ hash });

      // Tell the server the stake is mined — server verifies on-chain then enqueues.
      socket?.emit("confirm_stake", { reservationId: reservation.reservationId });
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      const msg =
        code === 4001
          ? "Transaction rejected in wallet."
          : (err as Error)?.message || "Staking transaction failed.";
      setError(msg);
      setTrackedPhase("ready_to_stake");
    } finally {
      submitting.current = false;
    }
  }, [reservation, address, provider, sendTransactionAsync, socket, setTrackedPhase]);

  // ── Withdraw (leave queue) ─────────────────────────────────────────────────
  // The server calls serverWithdrawStake on-chain on behalf of the player, so
  // no user-signed transaction is required. We just tell the server to dequeue
  // us and wait for the queue_left event to confirm.
  const withdraw = useCallback(() => {
    if (phaseRef.current !== "queued") return;
    setError(null);
    setTrackedPhase("withdrawing");
    socket?.emit("leave_queue");
  }, [socket, setTrackedPhase]);

  return { phase, txHash, error, stake, withdraw };
}
