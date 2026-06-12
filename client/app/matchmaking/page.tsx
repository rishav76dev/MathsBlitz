"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMatchmaking } from "../hooks/useMatchmaking";
import { useAuth } from "../hooks/useAuth";
import { useSocket } from "../hooks/useSocket";
import { useWallet } from "../hooks/useWallet";
import { ConnectWalletButton } from "../components/ConnectWalletButton";
import { WagerStaking } from "../components/WagerStaking";
import { WAGER_TIERS, type WagerAmount } from "../lib/gameTypes";
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
  const { address, balance, chainName } = useWallet();
  const {
    queueStatus,
    selectedWager,
    matchFound,
    joinQueue,
    leaveQueue,
    reset,
  } = useMatchmaking();

  // Hold a wager selection made before socket is ready; join as soon as it connects.
  const [pendingWager, setPendingWager] = useState<WagerAmount | null>(null);

  const goToGame = useCallback(() => {
    if (matchFound) {
      router.push(`/game/${matchFound.matchId}?wager=${matchFound.wager}`);
    }
  }, [matchFound, router]);

  useEffect(() => {
    if (matchFound && !matchFound.escrowEnabled) goToGame();
  }, [matchFound, goToGame]);

  // Auto-join once socket connects if the user already tapped a wager.
  useEffect(() => {
    if (socketStatus === "connected" && pendingWager !== null) {
      joinQueue(pendingWager);
      setPendingWager(null);
    }
  }, [socketStatus, pendingWager, joinQueue]);

  const handleWagerSelect = useCallback((w: WagerAmount) => {
    if (socketStatus === "connected") {
      joinQueue(w);
    } else {
      setPendingWager(w);
    }
  }, [socketStatus, joinQueue]);

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

  const socketDotColor = isSocketReady
    ? "bg-accent"
    : socketStatus === "error"
    ? "bg-destructive"
    : "bg-yellow-400 animate-pulse";

  const socketLabel = isSocketReady
    ? "Ready"
    : socketStatus === "error"
    ? "Error"
    : "Connecting…";

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
        <div className="flex items-center gap-3">
          {address && (
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-accent shadow-[0_0_4px_var(--color-accent)]" />
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {address.slice(0, 6)}…{address.slice(-4)}
                {chainName ? ` · ${chainName}` : ""}
                {balance ? ` · ${parseFloat(balance).toFixed(2)} CELO` : ""}
              </span>
              <span className="text-xs text-muted-foreground sm:hidden">Wallet</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${socketDotColor}`} />
            <span className="text-xs text-muted-foreground">{socketLabel}</span>
          </div>
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
                <p className="text-xs text-muted-foreground">
                  {user.wins}W · {user.losses}L · {user.matchesPlayed} played
                </p>
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
              <div className="flex justify-center w-full">
                {WAGER_TIERS.map((w) => {
                  const isPending = pendingWager === w;
                  const isError = socketStatus === "error";
                  return (
                    <button
                      key={w}
                      onClick={() => handleWagerSelect(w)}
                      disabled={isError}
                      className={`
                        w-36 flex flex-col items-center justify-center rounded-xl border py-4 gap-0.5
                        text-sm transition cursor-pointer
                        ${isError
                          ? "border-border text-muted-foreground opacity-40 cursor-not-allowed"
                          : isPending
                          ? "border-accent bg-sage-soft text-accent animate-pulse"
                          : "border-border text-foreground hover:border-accent/50 hover:bg-sage-soft hover:text-accent active:scale-95"}
                      `}
                    >
                      <span className="text-lg">{celoToBlitz(w).toLocaleString("en-US")}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {isPending ? "…" : "Blitz"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center max-w-xs">
              {pendingWager
                ? "Connecting to server — will join queue automatically."
                : "Tap to enter the queue. You will be matched with another player at the same stake. 10 Blitz = 0.01 CELO."}
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
