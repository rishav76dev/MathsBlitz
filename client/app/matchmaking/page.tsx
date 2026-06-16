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
  const { address, balance } = useWallet();
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
        <div
          className="flex size-16 items-center justify-center rounded-2xl bg-prosperity border-2 border-border"
          style={{ boxShadow: "4px 4px 0 #2D6A4F" }}
        >
          <RiFlashlightFill size={32} className="text-foreground" />
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
    : "text-sand animate-pulse";

  const socketLabel = isSocketReady ? "Ready" : socketStatus === "error" ? "Error" : "Connecting…";

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">

      {/* Header */}
      <header
        className="flex h-14 items-center justify-between border-b-2 border-border px-4"
        style={{ background: "#FCFF52" }}
      >
        <button
          onClick={() => router.push("/")}
          className="inline-flex items-center gap-1 text-sm font-semibold transition cursor-pointer"
          style={{ color: "#2D6A4F" }}
        >
          <RiArrowLeftSLine size={18} />
          Back
        </button>

        <div className="flex items-center gap-2">
          <span
            className="font-display text-sm font-bold tracking-tight"
            style={{ color: "#2D6A4F" }}
          >
            Find a Match
          </span>
          {/* Page indicator pill */}
          <span
            className="font-mono-game text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border-2 border-border hidden sm:inline"
            style={{ background: "#2D6A4F", color: "#FCFF52" }}
          >
            Join the Arena
          </span>
        </div>

        <div className="flex items-center gap-3">
          {address && (
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-accent" />
              <span className="font-mono-game text-xs" style={{ color: "#2D6A4F", opacity: 0.8 }}>
                {address.slice(0, 6)}…{address.slice(-4)}
                {balance ? ` · ${parseFloat(balance).toFixed(2)} CELO` : ""}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <SocketIcon size={13} className={socketColor} />
            <span className="text-xs font-semibold" style={{ color: "#2D6A4F", opacity: 0.8 }}>{socketLabel}</span>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-10">

        {/* User info card */}
        {user && (
          <div
            className="flex items-center gap-3 neo-card px-5 py-3"
          >
            <div
              className="flex size-10 items-center justify-center rounded-xl bg-prosperity border-2 border-border"
              style={{ boxShadow: "2px 2px 0 #2D6A4F" }}
            >
              <RiFlashlightFill size={18} className="text-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {user.username ?? `${user.walletAddress.slice(0, 6)}…${user.walletAddress.slice(-4)}`}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center gap-1 text-[11px] text-accent font-semibold">
                  <RiTrophyFill size={10} />{user.wins}W
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-destructive font-semibold">
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
              <p className="font-mono-game text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Select Wager
              </p>

              <div className="grid grid-cols-2 gap-3 w-full">
                {/* Live tiers */}
                {WAGER_TIERS.map((w) => {
                  const isError = socketStatus === "error";
                  const disabled = isError || !isSocketReady;
                  return (
                    <button
                      key={w}
                      onClick={() => handleWagerSelect(w)}
                      disabled={disabled}
                      className={`
                        flex flex-col items-center justify-center rounded-2xl border-2 py-5 gap-1
                        transition cursor-pointer
                        ${disabled
                          ? "border-border/30 text-muted-foreground opacity-40 cursor-not-allowed bg-muted"
                          : "neo-card hover:-translate-y-1"}
                      `}
                    >
                      <span className="font-display text-2xl font-bold text-primary">
                        {celoToBlitz(w).toLocaleString("en-US")}
                      </span>
                      <span className="font-mono-game text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Blitz
                      </span>
                    </button>
                  );
                })}

                {/* Upcoming tiers — shown as locked */}
                {([0.05, 0.1, 0.2, 0.5] as const).map((w) => (
                  <div
                    key={w}
                    className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-5 gap-1 select-none overflow-hidden"
                    style={{ borderColor: "#2D6A4F44", background: "#F5F0E6" }}
                  >
                    <span className="font-display text-2xl font-bold" style={{ color: "#2D6A4F55" }}>
                      {celoToBlitz(w).toLocaleString("en-US")}
                    </span>
                    <span className="font-mono-game text-[10px] font-bold uppercase tracking-wider" style={{ color: "#2D6A4F55" }}>
                      Blitz
                    </span>
                    {/* "Expanding soon" badge */}
                    <span
                      className="absolute top-2 right-2 font-mono-game text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ background: "#2D6A4F", color: "#FCFF52" }}
                    >
                      Soon
                    </span>
                  </div>
                ))}
              </div>

              {/* Expansion note */}
              <div
                className="w-full rounded-xl border-2 px-4 py-3 flex items-start gap-2.5"
                style={{ borderColor: "#2D6A4F33", background: "#2D6A4F0C" }}
              >
                <span className="text-lg leading-none mt-0.5">🌱</span>
                <p className="text-xs leading-relaxed" style={{ color: "#2D6A4F" }}>
                  Higher wager tiers unlock as the arena grows. Early players get first
                  access — the circle widens with every match played.
                </p>
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
