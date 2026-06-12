"use client";

import { useCallback, useEffect, useState } from "react";
import { useSocket } from "./useSocket";
import type { MatchFoundPayload, QueueStatus, WagerAmount } from "../lib/gameTypes";

export interface UseMatchmakingReturn {
  queueStatus: QueueStatus;
  selectedWager: WagerAmount | null;
  matchFound: MatchFoundPayload | null;
  joinQueue: (wager: WagerAmount) => void;
  leaveQueue: () => void;
  reset: () => void;
}

/**
 * Handles the pre-game matchmaking flow.
 * Emits join_queue / leave_queue and listens for queue_joined, queue_left, match_found.
 */
export function useMatchmaking(): UseMatchmakingReturn {
  const { socket } = useSocket();
  const [queueStatus, setQueueStatus] = useState<QueueStatus>("idle");
  const [selectedWager, setSelectedWager] = useState<WagerAmount | null>(null);
  const [matchFound, setMatchFound] = useState<MatchFoundPayload | null>(null);

  useEffect(() => {
    if (!socket) return;

    const onQueueJoined = () => setQueueStatus("queuing");
    const onQueueLeft = () => { setQueueStatus("idle"); setSelectedWager(null); };
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

  const joinQueue = useCallback((wager: WagerAmount) => {
    if (!socket?.connected) return;
    setSelectedWager(wager);
    socket.emit("join_queue", { wager });
  }, [socket]);

  const leaveQueue = useCallback(() => {
    if (!socket?.connected) return;
    socket.emit("leave_queue");
  }, [socket]);

  const reset = useCallback(() => {
    setQueueStatus("idle");
    setSelectedWager(null);
    setMatchFound(null);
  }, []);

  return { queueStatus, selectedWager, matchFound, joinQueue, leaveQueue, reset };
}
