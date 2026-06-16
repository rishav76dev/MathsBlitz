"use client";

import { useCallback, useEffect, useState } from "react";
import { useSocket } from "./useSocket";
import type { MatchFoundPayload, QueueStatus, WagerAmount } from "../lib/gameTypes";

export interface UseMatchmakingReturn {
  queueStatus: QueueStatus;
  selectedWager: WagerAmount | null;
  matchFound: MatchFoundPayload | null;
  setSelectedWager: (wager: WagerAmount | null) => void;
  leaveQueue: () => void;
  reset: () => void;
}

/**
 * Handles the matchmaking flow.
 * Wager selection and pre-queue staking are managed by WagerStaking/useEscrow.
 * This hook tracks queue status and surfaces match_found for navigation.
 */
export function useMatchmaking(): UseMatchmakingReturn {
  const { socket } = useSocket();
  const [queueStatus, setQueueStatus] = useState<QueueStatus>("idle");
  const [selectedWager, setSelectedWager] = useState<WagerAmount | null>(null);
  const [matchFound, setMatchFound] = useState<MatchFoundPayload | null>(null);

  useEffect(() => {
    if (!socket) return;

    const onQueueJoined = () => setQueueStatus("queuing");
    const onQueueLeft = () => { setQueueStatus("idle"); };
    const onMatchFound = (payload: MatchFoundPayload) => {
      setQueueStatus("matched");
      setMatchFound(payload);
    };

    socket.on("queue_joined", onQueueJoined);
    socket.on("queue_left", onQueueLeft);
    socket.on("match_found", onMatchFound);

    return () => {
      socket.off("queue_joined", onQueueJoined);
      socket.off("queue_left", onQueueLeft);
      socket.off("match_found", onMatchFound);
    };
  }, [socket]);

  const leaveQueue = useCallback(() => {
    if (!socket?.connected) return;
    socket.emit("leave_queue");
    setQueueStatus("idle");
    setSelectedWager(null);
  }, [socket]);

  const reset = useCallback(() => {
    setQueueStatus("idle");
    setSelectedWager(null);
    setMatchFound(null);
  }, []);

  return { queueStatus, selectedWager, matchFound, setSelectedWager, leaveQueue, reset };
}
