"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMatchmaking } from "../hooks/useMatchmaking";
import { useAuth } from "../hooks/useAuth";
import { useSocket } from "../hooks/useSocket";
import { ConnectWalletButton } from "../components/ConnectWalletButton";
import { WagerStaking } from "../components/WagerStaking";
import { WAGER_TIERS } from "../lib/gameTypes";
import { celoToBlitz } from "../lib/currency";

// ─── Animated dots ────────────────────────────────────────────────────────────
function WaitingDots() {
  return (
    <span className="inline-flex gap-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-2 rounded-full bg-accent animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MatchmakingPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { status: socketStatus } = useSocket();
  const {
    queueStatus,
    selectedWager,
    matchFound,
    joinQueue,
    leaveQueue,
    reset,
  } = useMatchmaking();

  const goToGame = useCallback(() => {
    if (matchFound) {
      router.push(`/game/${matchFound.matchId}?wager=${matchFound.wager}`);
    }
  }, [matchFound, router]);

  useEffect(() => {
    if (matchFound && !matchFound.escrowEnabled) goToGame();
  }, [matchFound, goToGame]);

  // ── Not authenticated ─────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
        <h1 className="text-2xl text-foreground">Connect your wallet to play</h1>
        <ConnectWalletButton />
      </div>
    );
  }

  const isQueuing = queueStatus === "queuing";
  const isSocketReady = socketStatus === "connected";
  const staking = matchFound?.escrowEnabled === true;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-border px-4 glass">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition cursor-pointer"
        >
          ← Back
        </button>
        <span className="text-sm text-foreground">Find a Match</span>
        <div className="flex items-center gap-1.5">
          <span
            className={`size-2 rounded-full ${isSocketReady ? "bg-accent" : "bg-muted-foreground"}`}
          />
          <span className="text-xs text-muted-foreground">
            {isSocketReady ? "Connected" : "Connecting…"}
          </span>
        </div>
      </header>

      {/* Body */}
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-10">
        {/* User info */}
        {user && (
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <div className="flex size-10 items-center justify-center rounded-full bg-surface border border-border text-base">
                ×
              </div>
              <div>
                <p className="text-sm text-foreground">
                  {user.username ?? `${user.walletAddress.slice(0, 6)}…${user.walletAddress.slice(-4)}`}
                </p>
                <p className="text-xs text-muted-foreground">ELO {user.elo}</p>
              </div>
            </div>
          </div>
        )}

        {/* Escrow staking handshake */}
        {staking && matchFound && (
          <WagerStaking
            key={matchFound.matchId}
            match={matchFound}
            onReady={goToGame}
            onExit={() => {
              leaveQueue();
              reset();
            }}
          />
        )}

        {/* Wager selector */}
        {!staking && !isQueuing && (
          <>
            <div className="flex flex-col items-center gap-3 w-full max-w-sm">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Select Wager (Blitz)
              </p>
              <div className="grid grid-cols-4 gap-3 w-full">
                {WAGER_TIERS.map((w) => (
                  <button
                    key={w}
                    onClick={() => joinQueue(w)}
                    disabled={!isSocketReady}
                    className={`
                      flex flex-col items-center justify-center rounded-xl border py-4 gap-0.5
                      text-sm transition cursor-pointer
                      ${!isSocketReady
                        ? "border-border text-muted-foreground opacity-50 cursor-not-allowed"
                        : "border-border text-foreground hover:border-accent/50 hover:bg-sage-soft hover:text-accent active:scale-95"}
                    `}
                  >
                    <span className="text-lg">{celoToBlitz(w).toLocaleString("en-US")}</span>
                    <span className="text-[10px] text-muted-foreground">Blitz</span>
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center max-w-xs">
              Tap a wager to instantly enter the queue. You will be matched with
              another player at the same stake. 1000 Blitz = 1 CELO.
            </p>
          </>
        )}

        {/* Queuing state */}
        {!staking && isQueuing && (
          <div className="flex flex-col items-center gap-6 w-full max-w-sm">
            {/* Pulse ring */}
            <div className="relative flex items-center justify-center">
              <div className="absolute size-28 rounded-full border-2 border-accent/20 animate-ping" />
              <div className="absolute size-20 rounded-full border-2 border-accent/15 animate-ping [animation-delay:0.3s]" />
              <div className="flex size-16 items-center justify-center rounded-full border-2 border-accent/40 bg-sage-soft">
                <span className="text-2xl">⚔️</span>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-base text-foreground">
                Finding opponent <WaitingDots />
              </div>
              <div className="rounded-full border border-accent/25 bg-sage-soft px-4 py-1.5 text-sm text-accent">
                {selectedWager !== null ? celoToBlitz(selectedWager).toLocaleString("en-US") : "—"} Blitz stake
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Waiting for another player at this wager…
              </p>
            </div>

            <button
              onClick={leaveQueue}
              className="w-full rounded-xl border border-border py-3 text-sm text-muted-foreground transition hover:border-foreground/30 hover:text-foreground cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
