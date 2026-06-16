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
} from "react-icons/ri";

function Spinner() {
  return <RiLoader4Line size={28} className="animate-spin text-primary" />;
}

function ExplorerLink({ chainId, txHash }: { chainId: number | null | undefined; txHash: string }) {
  const base = chainId === 42220 ? "https://celoscan.io/tx/" : "https://celo-sepolia.blockscout.com/tx/";
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

  useEffect(() => {
    if (phase === "withdrawn") onExit();
  }, [phase, onExit]);

  const blitzAmount = celoToBlitz(wager).toLocaleString("en-US");
  const potAmount   = celoToBlitz(wager * 2).toLocaleString("en-US");

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-sm">

      {/* Wager headline */}
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Stake to enter queue
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-5xl font-extrabold text-foreground tabular-nums">
            {blitzAmount}
          </span>
          <span className="text-xl text-primary font-semibold">Blitz</span>
        </div>
        <span className="text-xs text-muted-foreground">
          Winner takes{" "}
          <span className="text-primary font-medium">95%</span> of the{" "}
          <span className="text-foreground">{potAmount} Blitz</span> pot
        </span>
      </div>

      {/* State machine card */}
      <div className="flex flex-col items-center gap-4 w-full rounded-2xl border border-border bg-card px-6 py-7">

        {(phase === "idle" || phase === "requesting") && (
          <>
            <Spinner />
            <p className="text-sm text-muted-foreground text-center">Preparing your reservation…</p>
          </>
        )}

        {phase === "ready_to_stake" && (
          <>
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <RiCoinsFill size={28} />
            </div>
            <p className="text-sm text-muted-foreground text-center leading-relaxed">
              Stake {blitzAmount} Blitz to enter the queue.
              Your stake is refundable any time before you&apos;re matched.
            </p>
            <button
              onClick={stake}
              className="w-full rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition cursor-pointer"
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
            {txHash && <ExplorerLink chainId={null} txHash={txHash} />}
          </>
        )}

        {phase === "queued" && (
          <>
            <div className="relative flex items-center justify-center py-3">
              <div className="absolute size-20 rounded-full border border-primary/20 animate-ping" />
              <div className="absolute size-14 rounded-full border border-primary/15 animate-ping [animation-delay:0.35s]" />
              <div className="flex size-11 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
                <RiSwordFill size={22} />
              </div>
            </div>
            <p className="text-sm font-medium text-foreground text-center">
              Stake locked — finding opponent…
            </p>
            {txHash && <ExplorerLink chainId={null} txHash={txHash} />}
            <button
              onClick={withdraw}
              className="w-full rounded-xl border border-border py-3 text-sm text-muted-foreground hover:border-foreground/25 hover:text-foreground transition cursor-pointer"
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

        {phase === "error" && (
          <>
            <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
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
          className="inline-flex items-center gap-1 w-full justify-center rounded-xl border border-border py-3 text-sm text-muted-foreground hover:border-foreground/25 hover:text-foreground transition cursor-pointer"
        >
          <RiArrowLeftSLine size={16} />
          Cancel
        </button>
      )}
    </div>
  );
}
