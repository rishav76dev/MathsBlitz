"use client";

import { useEffect } from "react";
import { useEscrow } from "../hooks/useEscrow";
import type { WagerAmount } from "../lib/gameTypes";
import { celoToBlitz } from "../lib/currency";
import {
  RiLoader4Line,
  RiExternalLinkLine,
  RiCoinsFill,
  RiSwordFill,
  RiAlertFill,
  RiArrowLeftSLine,
  RiWalletFill,
  RiCheckLine,
} from "react-icons/ri";

function Spinner() {
  return <RiLoader4Line size={28} className="animate-spin text-primary" />;
}

function ExplorerLink({ txHash }: { txHash: string }) {
  const base = "https://celoscan.io/tx/";
  return (
    <a
      href={`${base}${txHash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-mono-game text-primary/70 hover:text-primary underline underline-offset-2 transition"
    >
      {txHash.slice(0, 10)}…{txHash.slice(-8)}
      <RiExternalLinkLine size={11} />
    </a>
  );
}

export function WagerStaking({ wager, onExit }: { wager: WagerAmount; onExit: () => void }) {
  const { phase, txHash, error, stake, withdraw } = useEscrow(wager);
  const ink = "#214d38";
  const accentBg = "#e4e75d";
  const cardBg = "rgba(220, 232, 211, 0.88)";
  const cardBgSoft = "rgba(220, 232, 211, 0.72)";

  useEffect(() => {
    if (phase !== "withdrawn") return;
    const t = setTimeout(onExit, 4000);
    return () => clearTimeout(t);
  }, [phase, onExit]);

  const blitzAmount = celoToBlitz(wager).toLocaleString("en-US");
  const potAmount   = celoToBlitz(wager * 2).toLocaleString("en-US");

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-sm">

      {/* Wager headline */}
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="font-mono-game text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Stake to enter queue
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-5xl font-extrabold text-foreground tabular-nums">
            {blitzAmount}
          </span>
          <span className="text-xl font-bold" style={{ color: "#214d38" }}>Blitz</span>
        </div>
        <span className="text-xs text-muted-foreground">
          Winner takes{" "}
          <span className="font-semibold" style={{ color: "#214d38" }}>95%</span> of the{" "}
          <span className="text-foreground font-medium">{potAmount} Blitz</span> pot
        </span>
      </div>

      {/* State machine card */}
      <div
        className="neo-card flex flex-col items-center gap-4 w-full px-6 py-7"
        style={{ background: cardBg }}
      >

        {(phase === "idle" || phase === "requesting") && (
          <>
            <Spinner />
            <p className="text-sm text-muted-foreground text-center">Preparing your reservation…</p>
          </>
        )}

        {phase === "ready_to_stake" && (
          <>
            <div
              className="flex size-14 items-center justify-center rounded-2xl bg-prosperity border-2 border-border"
              style={{ background: accentBg, boxShadow: `3px 3px 0 ${ink}` }}
            >
              <RiCoinsFill size={28} className="text-foreground" />
            </div>
            <p className="text-sm text-muted-foreground text-center leading-relaxed">
              Stake {blitzAmount} Blitz to enter the queue.
              Your stake is refundable any time before you&apos;re matched.
            </p>
            <button
              onClick={stake}
              className="neo-btn-primary w-full py-3.5 text-base"
              style={{ background: accentBg }}
            >
              Stake {blitzAmount} Blitz
            </button>
          </>
        )}

        {phase === "staking" && (
          <>
            <Spinner />
            <p className="text-sm text-muted-foreground text-center">Confirm the transaction in your wallet…</p>
          </>
        )}

        {phase === "confirming" && (
          <>
            <Spinner />
            <p className="text-sm text-muted-foreground text-center">Confirming your stake on-chain…</p>
            {txHash && <ExplorerLink txHash={txHash} />}
          </>
        )}

        {phase === "queued" && (
          <>
            <div className="relative flex items-center justify-center py-3">
              <div className="absolute size-20 rounded-full border-2 border-primary/25 animate-ping" />
              <div className="absolute size-14 rounded-full border-2 border-primary/20 animate-ping [animation-delay:0.35s]" />
              <div
                className="flex size-11 items-center justify-center rounded-full bg-prosperity border-2 border-border"
                style={{ background: accentBg, boxShadow: `3px 3px 0 ${ink}` }}
              >
                <RiSwordFill size={22} className="text-foreground" />
              </div>
            </div>
            <p className="text-sm font-semibold text-foreground text-center">
              Stake locked — finding opponent…
            </p>
            {txHash && <ExplorerLink txHash={txHash} />}
            <button
              onClick={withdraw}
              className="neo-btn-ghost w-full py-3 text-sm"
              style={{ background: cardBgSoft }}
            >
              Leave Queue &amp; Reclaim Stake
            </button>
          </>
        )}

        {phase === "withdrawing" && (
          <>
            <Spinner />
            <p className="text-sm text-muted-foreground text-center">Withdrawing your stake…</p>
          </>
        )}

        {phase === "withdrawn" && (
          <>
            <div
              className="flex size-14 items-center justify-center rounded-2xl border-2 border-border"
              style={{ background: accentBg, boxShadow: `3px 3px 0 ${ink}` }}
            >
              <RiWalletFill size={28} className="text-foreground" />
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest" style={{ color: ink }}>
                <RiCheckLine size={13} />
                Stake returned
              </span>
              <p className="text-sm text-foreground font-semibold">
                {blitzAmount} Blitz sent to your wallet
              </p>
              <p className="text-xs text-muted-foreground">You&apos;re back in the lobby.</p>
            </div>
          </>
        )}

        {phase === "error" && (
          <>
            <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive border-2 border-destructive/30">
              <RiAlertFill size={28} />
            </div>
            <p className="text-sm text-destructive text-center">{error || "Something went wrong."}</p>
          </>
        )}
      </div>

      {error && phase !== "error" && (
        <p className="text-xs text-destructive text-center max-w-xs">{error}</p>
      )}

      {(phase === "idle" || phase === "requesting" || phase === "ready_to_stake" || phase === "error") && (
        <button
          onClick={onExit}
          className="neo-btn-ghost inline-flex items-center gap-1 w-full justify-center py-3 text-sm"
          style={{ background: cardBgSoft }}
        >
          <RiArrowLeftSLine size={16} />
          Cancel
        </button>
      )}
    </div>
  );
}
