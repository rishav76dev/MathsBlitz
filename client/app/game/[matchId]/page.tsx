"use client";

import { useState, useEffect, useRef, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGame } from "../../hooks/useGame";
import { useAuth } from "../../hooks/useAuth";
import { celoToBlitz } from "../../lib/currency";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function truncateAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// ─── Timer Ring ───────────────────────────────────────────────────────────────
function TimerRing({ timeLeft, total = 60 }: { timeLeft: number; total?: number }) {
  const radius = 44;
  const circ = 2 * Math.PI * radius;
  const progress = Math.max(0, timeLeft / total);
  const offset = circ * (1 - progress);
  const isUrgent = timeLeft <= 10;

  return (
    <div className="relative flex items-center justify-center">
      <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90">
        {/* Track */}
        <circle
          cx="56" cy="56" r={radius}
          fill="none"
          stroke="oklch(0.88 0.014 92)"
          strokeWidth="8"
        />
        {/* Progress */}
        <circle
          cx="56" cy="56" r={radius}
          fill="none"
          stroke={isUrgent ? "oklch(0.58 0.22 28)" : "oklch(0.58 0.075 152)"}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-2xl tabular-nums ${isUrgent ? "text-destructive" : "text-foreground"}`}>
          {pad(Math.floor(timeLeft / 60))}:{pad(timeLeft % 60)}
        </span>
      </div>
    </div>
  );
}

// ─── Score Card ───────────────────────────────────────────────────────────────
function ScoreCard({ label, score, isWinner }: { label: string; score: number; isWinner?: boolean }) {
  return (
    <div className={`flex flex-col items-center rounded-2xl border px-6 py-4 min-w-[90px] transition
      ${isWinner ? "border-accent/40 bg-sage-soft" : "border-border bg-card"}`}>
      <span className="text-4xl tabular-nums text-foreground">{score}</span>
      <span className="mt-1 text-[11px] text-muted-foreground uppercase tracking-wide">{label}</span>
      {isWinner && <span className="mt-1 text-[10px] text-accent font-medium">WINNER</span>}
    </div>
  );
}

// ─── Number Pad ───────────────────────────────────────────────────────────────
function NumberPad({ value, onChange, onSubmit, onSkip }: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
}) {
  const keys = ["7","8","9","4","5","6","1","2","3","-","0","⌫"];

  const handleKey = (k: string) => {
    if (k === "⌫") { onChange(value.slice(0, -1)); return; }
    if (k === "-") {
      if (value.startsWith("-")) onChange(value.slice(1));
      else onChange("-" + value);
      return;
    }
    if (value.length >= 6) return;
    onChange(value + k);
  };

  return (
    <div className="flex flex-col gap-3 w-full max-w-xs">
      {/* Display */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
        <span className="text-2xl tabular-nums text-foreground min-w-[60px]">
          {value || <span className="text-muted-foreground">—</span>}
        </span>
        <button
          id="submit-answer-btn"
          onClick={onSubmit}
          disabled={!value || value === "-"}
          className="rounded-lg bg-primary px-5 py-2 text-sm text-primary-foreground shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition hover:opacity-90 active:scale-95 cursor-pointer"
        >
          Submit
        </button>
      </div>

      {/* Pad */}
      <div className="grid grid-cols-3 gap-2">
        {keys.map((k) => (
          <button
            key={k}
            onClick={() => handleKey(k)}
            className={`rounded-xl py-4 text-xl transition active:scale-95 cursor-pointer
              ${k === "⌫" ? "text-muted-foreground bg-surface hover:bg-muted"
              : k === "-" ? "text-accent bg-surface hover:bg-muted"
              : "text-foreground bg-surface hover:bg-muted"}`}
          >
            {k}
          </button>
        ))}
      </div>

      {/* Skip */}
      <button
        onClick={onSkip}
        className="w-full rounded-xl border border-border bg-surface py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition active:scale-95 cursor-pointer"
      >
        Skip question
      </button>
    </div>
  );
}

// ─── Settlement Badge ─────────────────────────────────────────────────────────
function SettlementBadge({ settlement, iWon, isDraw }: {
  settlement: import("../../lib/gameTypes").SettlementUpdatePayload | null;
  iWon: boolean;
  isDraw: boolean;
}) {
  if (!settlement) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <span className="size-2 rounded-full bg-yellow-400 animate-pulse" />
        Settling on-chain…
      </div>
    );
  }

  const { status, txHash } = settlement;
  const explorerBase = "https://celo-sepolia.blockscout.com/tx/";

  if (status === "confirmed") {
    const label = isDraw ? "Refund sent to your wallet" : iWon ? "Prize sent to your wallet" : "Result confirmed on-chain";
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-sage-soft px-4 py-3 text-sm text-accent">
          <span>✓</span> {label}
        </div>
        {txHash && (
          <a href={`${explorerBase}${txHash}`} target="_blank" rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
            View transaction ↗
          </a>
        )}
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Settlement failed — contact support with Match ID
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
      <span className="size-2 rounded-full bg-yellow-400 animate-pulse" />
      {status === "submitted" ? "Transaction submitted…" : "Settling on-chain…"}
    </div>
  );
}

// ─── End Screen ───────────────────────────────────────────────────────────────
function EndScreen({ winner, myUserId, myScore, opponentScore, wager, matchId, settlement, onRematch }: {
  winner: string | null;
  myUserId: string | null;
  myScore: number;
  opponentScore: number;
  wager: number;
  matchId: string;
  settlement: import("../../lib/gameTypes").SettlementUpdatePayload | null;
  onRematch: () => void;
}) {
  const iWon = winner === myUserId;
  const isDraw = !winner;

  return (
    <div className="flex flex-col items-center gap-6 py-10 px-4 text-center">
      <div className={`flex size-24 items-center justify-center rounded-full text-5xl
        ${iWon ? "bg-sage-soft" : isDraw ? "bg-sand/30" : "bg-destructive/10"}`}>
        {iWon ? "🏆" : isDraw ? "🤝" : "💀"}
      </div>

      <div className="flex flex-col gap-1">
        <h2 className={`text-3xl
          ${iWon ? "text-accent" : isDraw ? "text-[var(--sand)]" : "text-destructive"}`}>
          {iWon ? "You Won!" : isDraw ? "It's a Draw!" : "You Lost"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Match ID: {matchId.slice(-8).toUpperCase()}
        </p>
      </div>

      <div className="flex gap-4">
        <ScoreCard label="You" score={myScore} isWinner={iWon} />
        <ScoreCard label="Them" score={opponentScore} isWinner={!iWon && !isDraw} />
      </div>

      <div className="rounded-xl border border-border bg-card px-5 py-3 text-sm text-muted-foreground">
        Wager: <span className="text-foreground">{celoToBlitz(wager).toLocaleString("en-US")} Blitz</span>
      </div>

      <SettlementBadge settlement={settlement} iWon={iWon} isDraw={isDraw} />

      <button
        id="play-again-btn"
        onClick={onRematch}
        className="w-full max-w-xs rounded-xl bg-primary py-4 text-base text-primary-foreground shadow-sm hover:opacity-90 transition cursor-pointer"
      >
        Play Again
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function GamePage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const wager = parseFloat(searchParams.get("wager") ?? "1");

  const {
    phase,
    myUserId,
    opponentAddress,
    currentQuestion,
    myScore,
    opponentScore,
    duration,
    timeLeft,
    winner,
    opponentDisconnected,
    settlement,
    submitAnswer,
    skipQuestion,
  } = useGame(matchId, wager);

  const [inputValue, setInputValue] = useState("");
  const prevQuestionId = useRef<string | null>(null);

  useEffect(() => {
    if (currentQuestion?.id && currentQuestion.id !== prevQuestionId.current) {
      prevQuestionId.current = currentQuestion.id;
      setInputValue("");
    }
  }, [currentQuestion?.id]);

  const handleSubmit = () => {
    const num = parseInt(inputValue, 10);
    if (isNaN(num)) return;
    submitAnswer(num);
    setInputValue("");
  };

  const handleSkip = () => {
    skipQuestion();
    setInputValue("");
  };

  // Keyboard support
  useEffect(() => {
    if (phase !== "playing") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        setInputValue((v) => v.length >= 6 ? v : v + e.key);
      } else if (e.key === "-") {
        setInputValue((v) => v.startsWith("-") ? v.slice(1) : "-" + v);
      } else if (e.key === "Backspace") {
        setInputValue((v) => v.slice(0, -1));
      } else if (e.key === "Enter") {
        const num = parseInt(inputValue, 10);
        if (!isNaN(num)) {
          submitAnswer(num);
          setInputValue("");
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, inputValue, submitAnswer]);

  // ── Waiting for game_started ──────────────────────────────────────────────
  if (phase === "waiting") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <div className="size-10 rounded-full border-2 border-border border-t-accent animate-spin" />
        <p className="text-sm text-muted-foreground">Waiting for game to start…</p>
        {opponentDisconnected && (
          <p className="text-sm text-[var(--sand)]">Opponent disconnected</p>
        )}
      </div>
    );
  }

  // ── Game ended ────────────────────────────────────────────────────────────
  if (phase === "ended") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <EndScreen
          winner={winner}
          myUserId={myUserId ?? user?.id ?? null}
          myScore={myScore}
          opponentScore={opponentScore}
          wager={wager}
          matchId={matchId}
          settlement={settlement}
          onRematch={() => router.push("/matchmaking")}
        />
      </div>
    );
  }

  // ── Active game ───────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex flex-col">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">You</span>
          <span className="text-xs text-foreground font-mono">
            {user ? truncateAddr(user.walletAddress) : "—"}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Opponent</span>
          <span className="text-xs text-foreground font-mono">
            {opponentAddress ? truncateAddr(opponentAddress) : "—"}
          </span>
        </div>
      </div>

      {/* Disconnect banner */}
      {opponentDisconnected && (
        <div className="bg-sand/20 border-b border-sand/30 px-4 py-2 text-center text-xs text-[var(--sand)]">
          Opponent disconnected — waiting for result…
        </div>
      )}

      {/* Main gameplay area */}
      <div className="flex flex-1 flex-col items-center gap-6 px-4 py-6">
        {/* Timer + Scores */}
        <div className="flex items-center justify-between w-full max-w-sm">
          <ScoreCard label="You" score={myScore} />
          <TimerRing timeLeft={timeLeft} total={duration} />
          <ScoreCard label="Them" score={opponentScore} />
        </div>

        {/* Question */}
        <div className="flex flex-col items-center gap-3 w-full max-w-sm">
          <div className="w-full rounded-2xl border border-border bg-card px-6 py-8 text-center">
            {currentQuestion ? (
              <>
                <span className={`text-[10px] uppercase tracking-widest mb-3 block
                  ${currentQuestion.difficulty === 1 ? "text-accent"
                  : currentQuestion.difficulty === 2 ? "text-[var(--sand)]"
                  : "text-destructive"}`}>
                  {currentQuestion.difficulty === 1 ? "Easy" : currentQuestion.difficulty === 2 ? "Medium" : "Hard"}
                </span>
                <p className="text-4xl text-foreground">
                  {currentQuestion.question} = ?
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Waiting for question…</p>
            )}
          </div>
        </div>

        {/* Answer input */}
        <NumberPad
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSubmit}
          onSkip={handleSkip}
        />
      </div>
    </div>
  );
}
