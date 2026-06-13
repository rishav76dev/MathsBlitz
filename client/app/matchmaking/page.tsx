"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMatchmaking } from "../hooks/useMatchmaking";
import { useAuth } from "../hooks/useAuth";
import { useSocket } from "../hooks/useSocket";
import { useWallet } from "../hooks/useWallet";
import { ConnectWalletButton } from "../components/ConnectWalletButton";
import { WagerStaking } from "../components/WagerStaking";
import { WAGER_TIERS, type WagerAmount } from "../lib/gameTypes";
import { celoToBlitz } from "../lib/currency";

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MatchmakingPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { status: socketStatus } = useSocket();
  const { address, balance, chainName } = useWallet();
  const {
    matchFound,
    selectedWager,
    setSelectedWager,
    leaveQueue,
    reset,
  } = useMatchmaking();

  // Navigate to game as soon as both stakes are linked (match_found fires post-linkMatch).
  const goToGame = useCallback(() => {
    if (matchFound) router.push(`/game/${matchFound.matchId}?wager=${matchFound.wager}`);
  }, [matchFound, router]);

  useEffect(() => {
    if (matchFound) goToGame();
  }, [matchFound, goToGame]);

  const handleWagerSelect = useCallback((w: WagerAmount) => {
    setSelectedWager(w);
  }, [setSelectedWager]);

  const handleExit = useCallback(() => {
    leaveQueue();
    reset();
    setSelectedWager(null);
  }, [leaveQueue, reset, setSelectedWager]);

  // ── Not authenticated ─────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
        <h1 className="text-2xl text-foreground">Connect your wallet to play</h1>
        <ConnectWalletButton />
      </div>
    );
  }

  const isSocketReady = socketStatus === "connected";

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

        {/* Staking + queue UI — shown once a wager is selected */}
        {selectedWager !== null && (
          <WagerStaking
            key={selectedWager}
            wager={selectedWager}
            onExit={handleExit}
          />
        )}

        {/* Wager selector — shown before a wager is picked */}
        {selectedWager === null && (
          <>
            <div className="flex flex-col items-center gap-3 w-full max-w-sm">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Select Wager (Blitz)
              </p>
              <div className="flex justify-center w-full">
                {WAGER_TIERS.map((w) => {
                  const isError = socketStatus === "error";
                  return (
                    <button
                      key={w}
                      onClick={() => handleWagerSelect(w)}
                      disabled={isError || !isSocketReady}
                      className={`
                        w-36 flex flex-col items-center justify-center rounded-xl border py-4 gap-0.5
                        text-sm transition cursor-pointer
                        ${isError || !isSocketReady
                          ? "border-border text-muted-foreground opacity-40 cursor-not-allowed"
                          : "border-border text-foreground hover:border-accent/50 hover:bg-sage-soft hover:text-accent active:scale-95"}
                      `}
                    >
                      <span className="text-lg">{celoToBlitz(w).toLocaleString("en-US")}</span>
                      <span className="text-[10px] text-muted-foreground">Blitz</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center max-w-xs">
              {!isSocketReady
                ? "Connecting to server…"
                : "Select a wager to stake and enter the queue. Your stake is refundable before a match is found."}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
