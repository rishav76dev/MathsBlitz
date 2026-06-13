"use client";

import { useEffect } from "react";
import { useEscrow } from "../hooks/useEscrow";
import type { WagerAmount } from "../lib/gameTypes";
import { celoToBlitz } from "../lib/currency";

function Spinner() {
  return <div className="size-8 rounded-full border-2 border-border border-t-accent animate-spin" />;
}

function ExplorerLink({ chainId, txHash }: { chainId: number | null | undefined; txHash: string }) {
  // TODO: migrate to mainnet — swap celoscan.io for the default when CELO_NETWORK=mainnet.
  const base = chainId === 42220 ? "https://celoscan.io/tx/" : "https://celo-sepolia.blockscout.com/tx/";
  return (
    <a
      href={`${base}${txHash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs font-mono text-accent/80 hover:text-accent underline underline-offset-2"
    >
      {txHash.slice(0, 10)}…{txHash.slice(-8)}
    </a>
  );
}

/**
 * Pre-queue staking UI. Handles the full stake → queue → opponent-search flow.
 * The parent should navigate to the game when match_found fires.
 */
export function WagerStaking({
  wager,
  onExit,
}: {
  wager: WagerAmount;
  onExit: () => void;
}) {
  const { phase, txHash, error, stake, withdraw } = useEscrow(wager);

  // withdrawn = stake reclaimed, auto-exit to lobby.
  useEffect(() => {
    if (phase === "withdrawn") onExit();
  }, [phase, onExit]);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm">
      {/* Wager headline */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Stake to enter queue</span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-4xl text-foreground tabular-nums">{celoToBlitz(wager).toLocaleString("en-US")}</span>
          <span className="text-lg text-accent">Blitz</span>
        </div>
        <span className="text-xs text-muted-foreground">
          Winner takes <span className="text-accent">95%</span> of the {celoToBlitz(wager * 2).toLocaleString("en-US")} Blitz pot
        </span>
      </div>

      {/* State machine UI */}
      <div className="flex flex-col items-center gap-4 w-full rounded-2xl border border-border bg-card px-6 py-7">

        {phase === "idle" || phase === "requesting" ? (
          <>
            <Spinner />
            <p className="text-sm text-muted-foreground text-center">Preparing your reservation…</p>
          </>
        ) : null}

        {phase === "ready_to_stake" && (
          <>
            <div className="flex size-12 items-center justify-center rounded-full bg-sage-soft text-2xl">💰</div>
            <p className="text-sm text-muted-foreground text-center">
              Stake {celoToBlitz(wager).toLocaleString("en-US")} Blitz to enter the queue.
              Your stake is refundable any time before you&apos;re matched.
            </p>
            <button
              onClick={stake}
              className="w-full rounded-xl bg-primary py-3.5 text-base text-primary-foreground shadow-sm hover:opacity-90 active:scale-95 transition cursor-pointer"
            >
              Stake {celoToBlitz(wager).toLocaleString("en-US")} Blitz
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
            {/* Pulse ring — searching for opponent */}
            <div className="relative flex items-center justify-center py-2">
              <div className="absolute size-20 rounded-full border-2 border-accent/20 animate-ping" />
              <div className="absolute size-14 rounded-full border-2 border-accent/15 animate-ping [animation-delay:0.3s]" />
              <div className="flex size-10 items-center justify-center rounded-full border-2 border-accent/40 bg-sage-soft text-lg">⚔️</div>
            </div>
            <p className="text-sm text-foreground text-center">Stake locked — finding opponent…</p>
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
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-2xl">⚠️</div>
            <p className="text-sm text-destructive text-center">{error || "Something went wrong."}</p>
          </>
        )}
      </div>

      {error && phase !== "error" && (
        <p className="text-xs text-destructive text-center max-w-xs">{error}</p>
      )}

      {/* Cancel / back button — shown before stake is locked */}
      {(phase === "idle" || phase === "requesting" || phase === "ready_to_stake" || phase === "error") && (
        <button
          onClick={onExit}
          className="w-full rounded-xl border border-border py-3 text-sm text-muted-foreground hover:border-foreground/25 hover:text-foreground transition cursor-pointer"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
