import { io, type Socket } from "socket.io-client";
import type {
  QueueJoinedPayload,
  QueueLeftPayload,
  ReservationReadyPayload,
  MatchFoundPayload,
  GameStartedPayload,
  NewQuestionPayload,
  ScoreUpdatePayload,
  GameEndedPayload,
  OpponentDisconnectedPayload,
  EscrowUpdatePayload,
  EscrowReadyPayload,
  EscrowExpiredPayload,
  EscrowErrorPayload,
  SettlementUpdatePayload,
  StakeAndQueuePayload,
  JoinQueuePayload,
  SubmitAnswerPayload,
  ConfirmStakePayload,
} from "./gameTypes";

// ─── Typed socket interface ───────────────────────────────────────────────────
interface ServerToClientEvents {
  reservation_ready: (payload: ReservationReadyPayload) => void;
  queue_joined: (payload: QueueJoinedPayload) => void;
  queue_left: (payload: QueueLeftPayload) => void;
  match_found: (payload: MatchFoundPayload) => void;
  escrow_update: (payload: EscrowUpdatePayload) => void;
  escrow_ready: (payload: EscrowReadyPayload) => void;
  escrow_expired: (payload: EscrowExpiredPayload) => void;
  escrow_error: (payload: EscrowErrorPayload) => void;
  settlement_update: (payload: SettlementUpdatePayload) => void;
  game_started: (payload: GameStartedPayload) => void;
  new_question: (payload: NewQuestionPayload) => void;
  score_update: (payload: ScoreUpdatePayload) => void;
  game_ended: (payload: GameEndedPayload) => void;
  opponent_disconnected: (payload: OpponentDisconnectedPayload) => void;
  error_event: (payload: { message: string }) => void;
}

interface ClientToServerEvents {
  stake_and_queue: (payload: StakeAndQueuePayload) => void;
  join_queue: (payload: JoinQueuePayload) => void;
  leave_queue: () => void;
  confirm_stake: (payload: ConfirmStakePayload) => void;
  game_ready: (payload: { matchId: string }) => void;
  submit_answer: (payload: SubmitAnswerPayload) => void;
  skip_question: (payload: { matchId: string; questionId: string }) => void;
}

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Create a new Socket.IO instance with the given JWT token.
 * Call this once the user is authenticated.
 * Pass `autoConnect: false` so callers control the connection lifecycle.
 */
export function createGameSocket(token: string): GameSocket {
  return io(SOCKET_URL, {
    auth: { token },
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10_000,
  }) as GameSocket;
}
