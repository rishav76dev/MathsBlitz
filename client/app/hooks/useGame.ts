"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "./useSocket";
import { useAuth } from "./useAuth";
import type {
  GameState,
  GameStartedPayload,
  NewQuestionPayload,
  ScoreUpdatePayload,
  GameEndedPayload,
  OpponentDisconnectedPayload,
} from "../lib/gameTypes";

// Fallback only — the authoritative match length comes from the server's
// game_started payload (durationSeconds), so client and server can't disagree.
const MATCH_DURATION = 30;

const initialState = (matchId: string, wager: number): GameState => ({
  phase: "waiting",
  matchId,
  myUserId: null,
  opponentAddress: null,
  currentQuestion: null,
  myScore: 0,
  opponentScore: 0,
  duration: MATCH_DURATION,
  timeLeft: MATCH_DURATION,
  winner: null,
  opponentDisconnected: false,
  wager,
});

/**
 * Full gameplay hook for an active match.
 *
 * @param matchId - from the URL param
 * @param wager   - wager used for this match
 */
export function useGame(matchId: string, wager: number) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [state, setState] = useState<GameState>(() => initialState(matchId, wager));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Socket event listeners ───────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !matchId) return;

    const onGameStarted = (payload: GameStartedPayload) => {
      if (payload.matchId !== matchId) return;
      // Server is authoritative for match length.
      const duration = payload.durationSeconds || MATCH_DURATION;
      setState((s) => ({
        ...s,
        phase: "playing",
        myUserId: user?.id ?? null,
        duration,
        timeLeft: duration,
        opponentAddress: Object.entries(payload.players).find(
          ([uid]) => uid !== user?.id
        )?.[1] ?? null,
      }));

      // Start client-side countdown (display only — server is source of truth)
      timerRef.current = setInterval(() => {
        setState((s) => {
          const next = s.timeLeft - 1;
          if (next <= 0) {
            clearInterval(timerRef.current!);
            return { ...s, timeLeft: 0 };
          }
          return { ...s, timeLeft: next };
        });
      }, 1000);
    };

    const onNewQuestion = (payload: NewQuestionPayload) => {
      if (payload.matchId !== matchId) return;
      setState((s) => ({ ...s, currentQuestion: payload.question }));
    };

    const onScoreUpdate = (payload: ScoreUpdatePayload) => {
      if (payload.matchId !== matchId) return;
      const myId = user?.id;
      if (!myId) return;
      const myScore = payload.scores[myId] ?? 0;
      const opponentScore = Object.entries(payload.scores).find(
        ([uid]) => uid !== myId
      )?.[1] ?? 0;
      setState((s) => ({ ...s, myScore, opponentScore }));
    };

    const onGameEnded = (payload: GameEndedPayload) => {
      if (payload.matchId !== matchId) return;
      clearInterval(timerRef.current!);
      const myId = user?.id;
      const myScore = myId ? (payload.scores[myId] ?? 0) : 0;
      const opponentScore = myId
        ? (Object.entries(payload.scores).find(([uid]) => uid !== myId)?.[1] ?? 0)
        : 0;
      setState((s) => ({
        ...s,
        phase: "ended",
        winner: payload.winner,
        myScore,
        opponentScore,
        timeLeft: 0,
      }));
    };

    const onOpponentDisconnected = (payload: OpponentDisconnectedPayload) => {
      if (payload.matchId !== matchId) return;
      setState((s) => ({ ...s, opponentDisconnected: true }));
    };

    socket.on("game_started", onGameStarted);
    socket.on("new_question", onNewQuestion);
    socket.on("score_update", onScoreUpdate);
    socket.on("game_ended", onGameEnded);
    socket.on("opponent_disconnected", onOpponentDisconnected);

    return () => {
      socket.off("game_started", onGameStarted);
      socket.off("new_question", onNewQuestion);
      socket.off("score_update", onScoreUpdate);
      socket.off("game_ended", onGameEnded);
      socket.off("opponent_disconnected", onOpponentDisconnected);
      clearInterval(timerRef.current!);
    };
  }, [socket, matchId, user?.id]);

  // ── Submit answer ─────────────────────────────────────────────────────────
  const submitAnswer = useCallback(
    (answer: number) => {
      const q = state.currentQuestion;
      if (!socket?.connected || !q || !matchId) return;
      socket.emit("submit_answer", {
        matchId,
        questionId: q.id,
        answer,
      });
    },
    [socket, matchId, state.currentQuestion]
  );

  return { ...state, submitAnswer };
}
