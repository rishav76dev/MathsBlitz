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
import {
  RiFlashlightFill,
  RiArrowLeftSLine,
  RiWifiLine,
  RiWifiOffLine,
  RiLoader4Line,
  RiTrophyFill,
  RiCloseLine,
  RiGameFill,
} from "react-icons/ri";

export default function MatchmakingPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { status: socketStatus } = useSocket();
  const { address, balance, chainName } = useWallet();
  const { matchFound, selectedWager, setSelectedWager, leaveQueue, reset } = useMatchmaking();

  const goToGame = useCallback(() => {
    if (matchFound) router.push(`/game/${matchFound.matchId}?wager=${matchFound.wager}`);
  }, [matchFound, router]);

  useEffect(() => {
    if (matchFound) goToGame();
  }, [matchFound, goToGame]);

  const handleWagerSelect = useCallback((w: WagerAmount) => { setSelectedWager(w); }, [setSelectedWager]);
  const handleExit = useCallback(() => {
    leaveQueue(); reset(); setSelectedWager(null);
  }, [leaveQueue, reset, setSelectedWager]);

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <RiFlashlightFill size={32} />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground">Connect your wallet to play</h1>
        <ConnectWalletButton />
      </div>
    );
  }

  const isSocketReady = socketStatus === "connected";

  const SocketIcon = isSocketReady
    ? RiWifiLine
    : socketStatus === "error"
    ? RiWifiOffLine
    : RiLoader4Line;

  const socketColor = isSocketReady
    ? "text-accent"
    : socketStatus === "error"
    ? "text-destructive"
    : "text-[var(--sand)] animate-pulse";

  const socketLabel = isSocketReady ? "Ready" : socketStatus === "error" ? "Error" : "Connecting…";

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">

      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-border px-4 glass">
        <button
          onClick={() => router.push("/")}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition cursor-pointer"
        >
          <RiArrowLeftSLine size={18} />
          Back
        </button>

        <span className="font-display text-sm font-bold text-foreground tracking-tight">
          Find a Match
        </span>

        <div className="flex items-center gap-3">
          {address && (
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-accent shadow-[0_0_4px_var(--color-accent)]" />
              <span className="font-mono-game text-xs text-muted-foreground">
                {address.slice(0, 6)}…{address.slice(-4)}
                {chainName ? ` · ${chainName}` : ""}
                {balance ? ` · ${parseFloat(balance).toFixed(2)} CELO` : ""}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <SocketIcon size={13} className={socketColor} />
            <span className="text-xs text-muted-foreground">{socketLabel}</span>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-10">

        {/* User info card */}
        {user && (
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <RiFlashlightFill size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {user.username ?? `${user.walletAddress.slice(0, 6)}…${user.walletAddress.slice(-4)}`}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center gap-1 text-[11px] text-accent">
                  <RiTrophyFill size={10} />{user.wins}W
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-destructive">
                  <RiCloseLine size={10} />{user.losses}L
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <RiGameFill size={10} />{user.matchesPlayed}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Staking + queue UI */}
        {selectedWager !== null && (
          <WagerStaking key={selectedWager} wager={selectedWager} onExit={handleExit} />
        )}

        {/* Wager selector */}
        {selectedWager === null && (
          <>
            <div className="flex flex-col items-center gap-4 w-full max-w-sm">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                Select Wager
              </p>
              <div className="grid grid-cols-2 gap-3 w-full">
                {WAGER_TIERS.map((w) => {
                  const isError = socketStatus === "error";
                  const disabled = isError || !isSocketReady;
                  return (
                    <button
                      key={w}
                      onClick={() => handleWagerSelect(w)}
                      disabled={disabled}
                      className={`
                        flex flex-col items-center justify-center rounded-2xl border py-5 gap-1
                        transition cursor-pointer
                        ${disabled
                          ? "border-border text-muted-foreground opacity-40 cursor-not-allowed"
                          : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-surface active:scale-95"}
                      `}
                    >
                      <span className="font-display text-2xl font-bold text-primary">
                        {celoToBlitz(w).toLocaleString("en-US")}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Blitz
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center max-w-xs leading-relaxed">
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
