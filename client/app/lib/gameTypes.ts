// ─── Shared primitives ────────────────────────────────────────────────────────

export type WagerAmount = 0.01;

export const WAGER_TIERS: WagerAmount[] = [0.01];

// ─── Question (client-safe — no answer field) ─────────────────────────────────
export interface Question {
  id: string;
  question: string;
  difficulty: 1 | 2 | 3; // 1=easy 2=medium 3=hard
}

// ─── Server → Client event payloads ──────────────────────────────────────────
export interface QueueJoinedPayload {
  wager: number;
}

export interface QueueLeftPayload {
  // empty
}

/**
 * Sent by the server when a player's stake_and_queue request is accepted.
 * The client calls depositStake(reservationId) on-chain, then emits confirm_stake.
 */
export interface ReservationReadyPayload {
  reservationId: `0x${string}`;
  contractAddress: `0x${string}`;
  chainId: number;
  wager: number;
}

/**
 * Sent once BOTH players are matched AND their reservations have been linked
 * on-chain by the server. The game starts immediately after this event.
 */
export interface MatchFoundPayload {
  matchId: string;
  opponentAddress: string;
  wager: number;
  escrowEnabled: boolean;
  /** bytes32 matchId used on-chain (null when escrow disabled). */
  onchainMatchId: `0x${string}` | null;
  /** Deployed escrow contract address (null when escrow disabled). */
  contractAddress: `0x${string}` | null;
  /** Chain id the contract is deployed on (null when escrow disabled). */
  chainId: number | null;
}

export interface EscrowUpdatePayload {
  matchId: string;
  escrowStatus: "open" | "active" | "settled" | "cancelled";
}

export interface EscrowReadyPayload {
  matchId: string;
}

export interface EscrowExpiredPayload {
  matchId: string;
  reason?: string;
}

export interface EscrowErrorPayload {
  message: string;
}

export interface SettlementUpdatePayload {
  matchId: string;
  status: string;
  txHash: string | null;
  reason: string | null;
}

export interface GameStartedPayload {
  matchId: string;
  durationSeconds: number;
  /** userId → walletAddress */
  players: Record<string, string>;
}

export interface NewQuestionPayload {
  matchId: string;
  question: Question;
}

export interface ScoreUpdatePayload {
  matchId: string;
  /** userId → score */
  scores: Record<string, number>;
}

export interface GameEndedPayload {
  matchId: string;
  /** null = draw */
  winner: string | null;
  scores: Record<string, number>;
}

export interface OpponentDisconnectedPayload {
  matchId: string;
}

// ─── Client → Server event payloads ──────────────────────────────────────────
export interface StakeAndQueuePayload {
  wager: WagerAmount;
}

export interface JoinQueuePayload {
  wager: WagerAmount;
}

export interface SubmitAnswerPayload {
  matchId: string;
  questionId: string;
  answer: number;
}

export interface ConfirmStakePayload {
  reservationId: `0x${string}`;
}

// ─── Game state ───────────────────────────────────────────────────────────────
export type QueueStatus =
  | "idle"
  | "staking"  // pre-queue staking in progress
  | "queuing"  // staked and in queue, waiting for opponent
  | "matched";

export type GamePhase =
  | "waiting"   // before game_started
  | "playing"   // game in progress
  | "ended";    // game_ended received

export interface GameState {
  phase: GamePhase;
  matchId: string | null;
  myUserId: string | null;
  opponentAddress: string | null;
  currentQuestion: Question | null;
  myScore: number;
  opponentScore: number;
  duration: number; // total match length in seconds (from server)
  timeLeft: number; // seconds
  winner: string | null; // userId
  opponentDisconnected: boolean;
  wager: number;
  settlement: SettlementUpdatePayload | null;
}
