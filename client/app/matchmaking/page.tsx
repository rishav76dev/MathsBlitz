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
  // TODO: future feature — wins/losses stats icons
  // RiTrophyFill,
  // RiCloseLine,
  // RiGameFill,
} from "react-icons/ri";

export default function MatchmakingPage() {
  const pageBg = "linear-gradient(180deg, #ece3d0 0%, #e2d7c3 100%)";
  const ink = "#214d38";
  const inkSoft = "#2e6147";
  const panel = "#dce8d3";
  const panelBorder = "#214d3838";
  const panelBorderSoft = "#214d3822";
  const accentBg = "#e4e75d";
  const accentText = "#f6f2b0";
  const cardBg = "rgba(220, 232, 211, 0.88)";
  const cardBgSoft = "rgba(220, 232, 211, 0.68)";
  const activeTierBg = "linear-gradient(180deg, rgba(246, 244, 233, 0.98) 0%, rgba(230, 239, 219, 0.98) 100%)";
  const activeTierBorder = "#98ab8c";
  const activeTierText = "#214d38";

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
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-6 px-4"
        style={{ background: pageBg, filter: "brightness(0.92) saturate(0.88)" }}
      >
        <div
          className="flex size-16 items-center justify-center rounded-2xl border-2 border-border"
          style={{ background: accentBg, boxShadow: `4px 4px 0 ${ink}` }}
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
    <div
      className="flex min-h-screen flex-col text-foreground"
      style={{ background: pageBg }}
    >

      {/* Header */}
      <header
        className="flex h-14 items-center justify-between border-b-2 border-border px-4"
        style={{ background: accentBg, filter: "brightness(0.95) saturate(0.9)" }}
      >
        <button
          onClick={() => router.push("/")}
          className="inline-flex items-center gap-1 text-sm font-semibold transition cursor-pointer"
          style={{ color: ink }}
        >
          <RiArrowLeftSLine size={18} />
          Back
        </button>

        <div className="flex items-center gap-2">
          <span
            className="font-display text-sm font-bold tracking-tight"
            style={{ color: ink }}
          >
            Find a Match
          </span>
          {/* Page indicator pill */}
          <span
            className="font-mono-game text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border-2 border-border hidden sm:inline"
            style={{ background: ink, color: accentText }}
          >
            Join the Arena
          </span>
        </div>

        <div className="flex items-center gap-3">
          {address && (
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-accent" />
              <span className="font-mono-game text-xs" style={{ color: ink, opacity: 0.8 }}>
                {address.slice(0, 6)}…{address.slice(-4)}
                {balance ? ` · ${parseFloat(balance).toFixed(2)} CELO` : ""}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <SocketIcon size={13} className={socketColor} />
            <span className="text-xs font-semibold" style={{ color: ink, opacity: 0.8 }}>{socketLabel}</span>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-10">

        {/* User info card */}
        {user && (
          <div
            className="flex items-center gap-3 neo-card px-5 py-3"
            style={{ background: cardBg }}
          >
            <div
              className="flex size-10 items-center justify-center rounded-xl border-2 border-border"
              style={{ background: accentBg, boxShadow: `2px 2px 0 ${ink}` }}
            >
              <RiFlashlightFill size={18} className="text-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {user.username ?? `${user.walletAddress.slice(0, 6)}…${user.walletAddress.slice(-4)}`}
              </p>
              {/* TODO: future feature — wins/losses/matchesPlayed stats */}
              {/* <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center gap-1 text-[11px] text-accent font-semibold">
                  <RiTrophyFill size={10} />{user.wins}W
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-destructive font-semibold">
                  <RiCloseLine size={10} />{user.losses}L
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <RiGameFill size={10} />{user.matchesPlayed}
                </span>
              </div> */}
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
                      style={disabled ? undefined : {
                        background: activeTierBg,
                        borderColor: activeTierBorder,
                        boxShadow: "0 10px 24px rgba(33, 77, 56, 0.08)",
                      }}
                    >
                      <span className="font-display text-2xl font-bold" style={{ color: activeTierText }}>
                        {celoToBlitz(w).toLocaleString("en-US")}
                      </span>
                      <span className="font-mono-game text-[10px] font-bold uppercase tracking-wider" style={{ color: "#5d6f5c" }}>
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
                    style={{ borderColor: panelBorder, background: panel }}
                  >
                    <span className="font-display text-2xl font-bold" style={{ color: "#214d3855" }}>
                      {celoToBlitz(w).toLocaleString("en-US")}
                    </span>
                    <span className="font-mono-game text-[10px] font-bold uppercase tracking-wider" style={{ color: "#214d3855" }}>
                      Blitz
                    </span>
                    {/* "Expanding soon" badge */}
                    <span
                      className="absolute top-2 right-2 font-mono-game text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ background: ink, color: accentText }}
                    >
                      Soon
                    </span>
                  </div>
                ))}
              </div>

              {/* Expansion note */}
              <div
                className="w-full rounded-xl border-2 px-4 py-3 flex items-start gap-2.5"
                style={{ borderColor: panelBorderSoft, background: "rgba(220, 232, 211, 0.7)" }}
              >
                <span className="text-lg leading-none mt-0.5">🌱</span>
                <p className="text-xs leading-relaxed" style={{ color: inkSoft }}>
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
