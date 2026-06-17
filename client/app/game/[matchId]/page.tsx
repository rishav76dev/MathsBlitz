"use client";

import { useState, useEffect, useRef, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGame } from "../../hooks/useGame";
import { useAuth } from "../../hooks/useAuth";
import { useSocket } from "../../hooks/useSocket";
import { celoToBlitz } from "../../lib/currency";
import {
  RiTrophyFill,
  RiSkullFill,
  RiShakeHandsFill,
  RiLoader4Line,
  RiDeleteBackFill,
  RiCheckFill,
  RiCheckboxCircleFill,
  RiAlertFill,
  RiExternalLinkLine,
  RiSkipForwardFill,
  RiTimerFlashLine,
  RiFlashlightFill,
} from "react-icons/ri";

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
        <circle cx="56" cy="56" r={radius} fill="none"
          stroke="#2D6A4F30" strokeWidth="7" />
        <circle cx="56" cy="56" r={radius} fill="none"
          stroke={isUrgent ? "#C93625" : "#2D6A4F"}
          strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute flex flex-col items-center gap-0.5">
        <RiTimerFlashLine size={13} className={isUrgent ? "text-destructive" : "text-primary"} />
        <span className={`font-mono-game text-xl tabular-nums font-bold leading-none ${isUrgent ? "text-destructive" : "text-foreground"}`}>
          {pad(Math.floor(timeLeft / 60))}:{pad(timeLeft % 60)}
        </span>
      </div>
    </div>
  );
}

// ─── Score Card ───────────────────────────────────────────────────────────────
function ScoreCard({ label, score, isWinner }: { label: string; score: number; isWinner?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center rounded-2xl border-2 border-border px-6 py-4 min-w-20 transition bg-card`}
      style={isWinner ? { boxShadow: "4px 4px 0 #2D8653", borderColor: "#2D8653" } : { boxShadow: "3px 3px 0 #2D6A4F" }}
    >
      <span className={`font-display text-4xl font-extrabold tabular-nums ${isWinner ? "text-accent" : "text-foreground"}`}>
        {score}
      </span>
      <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      {isWinner && (
        <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-accent">
          <RiTrophyFill size={10} /> WIN
        </span>
      )}
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
  const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "-", "0", "⌫"];

  const handleKey = (k: string) => {
    if (k === "⌫") { onChange(value.slice(0, -1)); return; }
    if (k === "-") {
      onChange(value.startsWith("-") ? value.slice(1) : "-" + value);
      return;
    }
    if (value.length >= 6) return;
    onChange(value + k);
  };

  const canSubmit = !!value && value !== "-";

  return (
    <div className="flex flex-col gap-3 w-full max-w-xs">
      {/* Answer display + submit */}
      <div className="flex items-center gap-2 rounded-2xl border-2 border-border bg-card px-4 py-3" style={{ boxShadow: "3px 3px 0 #2D6A4F" }}>
        <span className="font-mono-game text-2xl tabular-nums text-foreground min-w-15 flex-1">
          {value || <span className="text-muted-foreground">—</span>}
        </span>
        <button
          id="submit-answer-btn"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="neo-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
        >
          <RiCheckFill size={14} />
          Submit
        </button>
      </div>

      {/* Number grid */}
      <div className="grid grid-cols-3 gap-2">
        {keys.map((k) => (
          <button
            key={k}
            onClick={() => handleKey(k)}
            className="neo-btn-ghost rounded-2xl py-4 font-mono-game text-xl font-bold"
          >
            {k === "⌫" ? <RiDeleteBackFill className="mx-auto" size={20} /> : k}
          </button>
        ))}
      </div>

      {/* Skip */}
      <button
        onClick={onSkip}
        className="neo-btn-ghost inline-flex items-center justify-center gap-2 w-full py-3 text-sm text-muted-foreground"
      >
        <RiSkipForwardFill size={15} />
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
        <span className="size-2 rounded-full bg-sand animate-pulse" />
        Settling on-chain…
      </div>
    );
  }

  const { status, txHash } = settlement;
  const explorerBase = "https://celo-sepolia.blockscout.com/tx/";

  if (status === "confirmed") {
    const label = isDraw
      ? "Refund sent to your wallet"
      : iWon
      ? "Prize sent to your wallet"
      : "Result confirmed on-chain";
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
          <RiCheckboxCircleFill size={15} />
          {label}
        </div>
        {txHash && (
          <a
            href={`${explorerBase}${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition"
          >
            View transaction <RiExternalLinkLine size={11} />
          </a>
        )}
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        <RiAlertFill size={15} />
        Settlement failed — contact support with Match ID
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
      <span className="size-2 rounded-full bg-sand animate-pulse" />
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

  const resultConfig = iWon
    ? { icon: RiTrophyFill,   bg: "bg-primary/10",     iconColor: "text-primary",     label: "You Won!",       labelColor: "text-primary" }
    : isDraw
    ? { icon: RiShakeHandsFill, bg: "bg-sand/15", iconColor: "text-sand", label: "It's a Draw!", labelColor: "text-sand" }
    : { icon: RiSkullFill,    bg: "bg-destructive/10", iconColor: "text-destructive", label: "You Lost",       labelColor: "text-destructive" };

  const ResultIcon = resultConfig.icon;

  return (
    <div className="flex flex-col items-center gap-6 py-12 px-4 text-center min-h-screen justify-center">
      <div className={`flex size-24 items-center justify-center rounded-3xl border-2 border-border ${resultConfig.bg} ${resultConfig.iconColor}`} style={{ boxShadow: "4px 4px 0 #2D6A4F" }}>
        <ResultIcon size={44} />
      </div>

      <div className="flex flex-col gap-1">
        <h2 className={`font-display text-4xl font-extrabold ${resultConfig.labelColor}`}>
          {resultConfig.label}
        </h2>
        <p className="font-mono-game text-xs text-muted-foreground">
          #{matchId.slice(-8).toUpperCase()}
        </p>
      </div>

      <div className="flex gap-4">
        <ScoreCard label="You" score={myScore} isWinner={iWon} />
        <ScoreCard label="Them" score={opponentScore} isWinner={!iWon && !isDraw} />
      </div>

      <div className="rounded-xl border-2 border-border bg-card px-5 py-3 text-sm text-muted-foreground" style={{ boxShadow: "3px 3px 0 #2D6A4F" }}>
        Wager:{" "}
        <span className="font-semibold text-primary">
          {celoToBlitz(wager).toLocaleString("en-US")} Blitz
        </span>
      </div>

      <SettlementBadge settlement={settlement} iWon={iWon} isDraw={isDraw} />

      <button
        id="play-again-btn"
        onClick={onRematch}
        className="neo-btn-primary inline-flex items-center gap-2 w-full max-w-xs justify-center py-4 text-base"
      >
        <RiFlashlightFill size={18} />
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
  const { socket } = useSocket();

  // Tell the server this client is on the game page and ready to receive game_started.
  useEffect(() => {
    if (!socket || !matchId) return;
    socket.emit("game_ready", { matchId });
  }, [socket, matchId]);

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

  useEffect(() => {
    if (phase !== "playing") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        setInputValue((v) => (v.length >= 6 ? v : v + e.key));
      } else if (e.key === "-") {
        setInputValue((v) => (v.startsWith("-") ? v.slice(1) : "-" + v));
      } else if (e.key === "Backspace") {
        setInputValue((v) => v.slice(0, -1));
      } else if (e.key === "Enter") {
        const num = parseInt(inputValue, 10);
        if (!isNaN(num)) { submitAnswer(num); setInputValue(""); }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, inputValue, submitAnswer]);

  // ── Waiting ───────────────────────────────────────────────────────────────
  if (phase === "waiting") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-prosperity border-2 border-border" style={{ boxShadow: "4px 4px 0 #2D6A4F" }}>
          <RiLoader4Line size={30} className="animate-spin text-foreground" />
        </div>
        <div className="flex flex-col items-center gap-1.5 text-center">
          <p className="font-display text-lg font-bold text-foreground">Starting match…</p>
          <p className="text-sm text-muted-foreground">Waiting for game to start</p>
        </div>
        {opponentDisconnected && (
          <div className="rounded-xl border border-sand/30 bg-sand/10 px-4 py-2 text-sm text-sand">
            Opponent disconnected
          </div>
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
  const difficultyConfig = {
    1: { label: "Easy",   color: "text-accent",      dotColor: "bg-accent" },
    2: { label: "Medium", color: "text-primary",     dotColor: "bg-primary" },
    3: { label: "Hard",   color: "text-destructive", dotColor: "bg-destructive" },
  } as const;

  const diff = (currentQuestion?.difficulty ?? 1) as 1 | 2 | 3;
  const dc = difficultyConfig[diff];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">

      {/* Top bar */}
      <div className="flex items-center justify-between border-b-2 border-border px-4 py-3" style={{ background: "#FCFF52" }}>
        <div className="flex flex-col">
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#2D6A4F", opacity: 0.7 }}>You</span>
          <span className="font-mono-game text-xs font-semibold" style={{ color: "#2D6A4F" }}>
            {user ? truncateAddr(user.walletAddress) : "—"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-2 rounded-full animate-pulse border border-border" style={{ background: "#2D6A4F" }} />
          <span className="font-display text-xs font-bold" style={{ color: "#2D6A4F" }}>LIVE</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#2D6A4F", opacity: 0.7 }}>Opponent</span>
          <span className="font-mono-game text-xs font-semibold" style={{ color: "#2D6A4F" }}>
            {opponentAddress ? truncateAddr(opponentAddress) : "—"}
          </span>
        </div>
      </div>

      {/* Disconnect banner */}
      {opponentDisconnected && (
        <div className="border-b border-sand/20 bg-sand/10 px-4 py-2 text-center text-xs text-sand">
          Opponent disconnected — waiting for result…
        </div>
      )}

      {/* Main gameplay */}
      <div className="flex flex-1 flex-col items-center gap-5 px-4 py-6">

        {/* Timer + Scores */}
        <div className="flex items-center justify-between w-full max-w-sm">
          <ScoreCard label="You" score={myScore} />
          <TimerRing timeLeft={timeLeft} total={duration} />
          <ScoreCard label="Them" score={opponentScore} />
        </div>

        {/* Question card */}
        <div className="w-full max-w-sm rounded-2xl border-2 border-border bg-card px-6 py-8 text-center" style={{ boxShadow: "4px 4px 0 #2D6A4F" }}>
          {currentQuestion ? (
            <>
              <div className="mb-3 flex items-center justify-center gap-1.5">
                <span className={`size-1.5 rounded-full ${dc.dotColor}`} />
                <span className={`text-[10px] font-bold uppercase tracking-widest ${dc.color}`}>
                  {dc.label}
                </span>
              </div>
              <p className="font-display text-4xl font-extrabold text-foreground tracking-tight">
                {currentQuestion.question} <span className="text-primary">=</span> ?
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Waiting for question…</p>
          )}
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
