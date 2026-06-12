"use client";

import { useEffect } from "react";
import { useEscrow } from "../hooks/useEscrow";
import type { MatchFoundPayload } from "../lib/gameTypes";
import { celoToBlitz } from "../lib/currency";

function Spinner() {
  return <div className="size-8 rounded-full border-2 border-border border-t-accent animate-spin" />;
}

function ExplorerLink({ chainId, txHash }: { chainId: number | null; txHash: string }) {
  const base = chainId === 42220 ? "https://celoscan.io/tx/" : "https://alfajores.celoscan.io/tx/";
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

export function WagerStaking({
  match,
  onReady,
  onExit,
}: {
  match: MatchFoundPayload;
  onReady: () => void;
  onExit: () => void;
}) {
  const { phase, txHash, error, stake, cancelStake } = useEscrow(match);
  const isCreator = match.role === "creator";

  useEffect(() => {
    if (phase === "ready") onReady();
  }, [phase, onReady]);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm">
      {/* Wager headline */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Match found — stake to play</span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-4xl text-foreground tabular-nums">{celoToBlitz(match.wager).toLocaleString("en-US")}</span>
          <span className="text-lg text-accent">Blitz</span>
        </div>
        <span className="text-xs text-muted-foreground">
          Winner takes <span className="text-accent">95%</span> of the {celoToBlitz(match.wager * 2).toLocaleString("en-US")} Blitz pot
        </span>
      </div>

      {/* State machine UI */}
      <div className="flex flex-col items-center gap-4 w-full rounded-2xl border border-border bg-card px-6 py-7">
        {phase === "awaiting_creator" && (
          <>
            <Spinner />
            <p className="text-sm text-muted-foreground text-center">Waiting for opponent to open the escrow…</p>
            <p className="text-xs text-muted-foreground text-center">You&apos;ll stake right after.</p>
          </>
        )}

        {phase === "ready_to_stake" && (
          <>
            <div className="flex size-12 items-center justify-center rounded-full bg-sage-soft text-2xl">💰</div>
            <p className="text-sm text-muted-foreground text-center">
              {isCreator
                ? `Open the match by staking ${celoToBlitz(match.wager).toLocaleString("en-US")} Blitz.`
                : `Opponent staked. Match your ${celoToBlitz(match.wager).toLocaleString("en-US")} Blitz stake to start.`}
            </p>
            <button
              onClick={stake}
              className="w-full rounded-xl bg-primary py-3.5 text-base text-primary-foreground shadow-sm hover:opacity-90 active:scale-95 transition cursor-pointer"
            >
              Stake {celoToBlitz(match.wager).toLocaleString("en-US")} Blitz
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
            {txHash && <ExplorerLink chainId={match.chainId} txHash={txHash} />}
          </>
        )}

        {phase === "waiting_opponent" && (
          <>
            <Spinner />
            <p className="text-sm text-muted-foreground text-center">Your stake is locked. Waiting for opponent to stake…</p>
            {txHash && <ExplorerLink chainId={match.chainId} txHash={txHash} />}
          </>
        )}

        {phase === "ready" && (
          <>
            <div className="flex size-12 items-center justify-center rounded-full bg-sage-soft text-2xl">✅</div>
            <p className="text-sm text-accent text-center">Both stakes locked — starting…</p>
          </>
        )}

        {phase === "expired" && (
          <>
            <div className="flex size-12 items-center justify-center rounded-full bg-sand/30 text-2xl">⌛</div>
            <p className="text-sm text-[var(--sand)] text-center">Match expired — both players didn&apos;t stake in time.</p>
            {isCreator && txHash && (
              <button
                onClick={cancelStake}
                className="w-full rounded-xl border border-border py-3 text-sm text-muted-foreground hover:border-foreground/25 hover:text-foreground transition cursor-pointer"
              >
                Reclaim my stake
              </button>
            )}
          </>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive text-center max-w-xs">{error}</p>
      )}

      {(phase === "ready_to_stake" || phase === "awaiting_creator" || phase === "expired") && (
        <button
          onClick={onExit}
          className="w-full rounded-xl border border-border py-3 text-sm text-muted-foreground hover:border-foreground/25 hover:text-foreground transition cursor-pointer"
        >
          {phase === "expired" ? "Back to lobby" : "Cancel"}
        </button>
      )}
    </div>
  );
}
