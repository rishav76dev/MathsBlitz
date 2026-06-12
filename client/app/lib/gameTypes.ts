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

export type EscrowRole = "creator" | "joiner";

export interface MatchFoundPayload {
  matchId: string;
  opponentAddress: string;
  wager: number;
  /** Whether this match requires an on-chain stake before play. */
  escrowEnabled: boolean;
  /** This player's role in the escrow handshake. */
  role: EscrowRole;
  /** bytes32 matchId for the escrow contract (null when escrow disabled). */
  onchainMatchId: `0x${string}` | null;
  /** Deployed escrow contract address (null when escrow disabled). */
  contractAddress: `0x${string}` | null;
  /** Chain id the contract is deployed on (null when escrow disabled). */
  chainId: number | null;
}

// ── Escrow handshake events ───────────────────────────────────────────────────
export type EscrowStatus = "open" | "active";

export interface EscrowUpdatePayload {
  matchId: string;
  escrowStatus: EscrowStatus;
}

export interface EscrowReadyPayload {
  matchId: string;
}

export interface EscrowExpiredPayload {
  matchId: string;
}

export interface EscrowErrorPayload {
  matchId: string;
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
export interface JoinQueuePayload {
  wager: WagerAmount;
}

export interface SubmitAnswerPayload {
  matchId: string;
  questionId: string;
  answer: number;
}

export interface ConfirmStakePayload {
  matchId: string;
}

// ─── Game state ───────────────────────────────────────────────────────────────
export type QueueStatus =
  | "idle"
  | "queuing"
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
}
