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
import type { ReservationReadyPayload } from "../lib/gameTypes";

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

export function useEscrow(wager: number | null): UseEscrowReturn {
  const { socket } = useSocket();
  const { address } = useWallet();
  const { provider } = useMiniPay();
  const { sendTransactionAsync } = useSendTransaction();

  const [phase, setPhase] = useState<EscrowPhase>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reservation, setReservation] = useState<ReservationReadyPayload | null>(null);
  const submitting = useRef(false);

  // ── Emit stake_and_queue when wager is set ─────────────────────────────────
  useEffect(() => {
    if (!socket || !wager) return;
    setPhase("requesting");
    setError(null);
    setReservation(null);
    setTxHash(null);
    socket.emit("stake_and_queue", { wager });
  }, [socket, wager]);

  // ── Server events ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onReservationReady = (payload: ReservationReadyPayload) => {
      setReservation(payload);
      setPhase("ready_to_stake");
    };

    const onQueueJoined = () => {
      setPhase("queued");
    };

    const onQueueLeft = () => {
      setPhase("withdrawn");
    };

    const onEscrowError = (payload: { message: string }) => {
      setError(payload.message);
      setPhase("error");
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
  }, [socket]);

  // ── Stake ──────────────────────────────────────────────────────────────────
  const stake = useCallback(async () => {
    if (!reservation || phase !== "ready_to_stake") return;
    if (!address) { setError("Wallet not connected."); return; }
    if (submitting.current) return;

    submitting.current = true;
    setError(null);
    setPhase("staking");

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
      setPhase("confirming");

      await getPublicClient(reservation.chainId).waitForTransactionReceipt({ hash });

      // Tell the server the stake is mined — server verifies on-chain then enqueues.
      socket?.emit("confirm_stake", { reservationId: reservation.reservationId });
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
  }, [reservation, phase, address, provider, sendTransactionAsync, socket]);

  // ── Withdraw (leave queue) ─────────────────────────────────────────────────
  // The server calls serverWithdrawStake on-chain on behalf of the player, so
  // no user-signed transaction is required. We just tell the server to dequeue
  // us and wait for the queue_left event to confirm.
  const withdraw = useCallback(() => {
    if (phase !== "queued") return;
    setError(null);
    setPhase("withdrawing");
    socket?.emit("leave_queue");
  }, [phase, socket]);

  return { phase, txHash, error, stake, withdraw };
}
