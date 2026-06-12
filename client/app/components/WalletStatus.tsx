"use client";

import { useState, useCallback } from "react";
import { useWallet } from "../hooks/useWallet";
import { useAuth } from "../hooks/useAuth";

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <rect width="13" height="13" x="9" y="9" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function formatBalance(balance: string | null): string {
  if (!balance) return "—";
  const num = parseFloat(balance);
  if (isNaN(num)) return "—";
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export function WalletStatus() {
  const { address, chainName, balance, isConnected, status } = useWallet();
  const { user, isAuthenticated } = useAuth();
  const [copied, setCopied] = useState(false);

  const copyAddress = useCallback(() => {
    if (!address) return;
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [address]);

  if (!isConnected) return null;

  const dotColor = status === "connected"
    ? "bg-accent shadow-[0_0_6px_var(--color-accent)]"
    : status === "connecting"
    ? "bg-[var(--sand)] animate-pulse"
    : "bg-destructive";

  return (
    <div role="region" aria-label="Wallet status"
      className="w-full max-w-md rounded-2xl border border-border bg-card shadow-sm p-5">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${dotColor}`} aria-hidden="true" />
          <span className="text-sm text-foreground">
            {isAuthenticated ? "Authenticated" : "Connected"}
          </span>
        </div>
        {chainName && (
          <span className="rounded-full border border-accent/25 bg-sage-soft px-2.5 py-0.5 text-[11px] text-accent">
            {chainName}
          </span>
        )}
      </div>

      <div className="h-px bg-border mb-4" aria-hidden="true" />

      {/* Address */}
      <div className="flex flex-col gap-1.5 mb-4">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Wallet Address
        </span>
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-lg bg-muted px-3 py-2 font-mono text-xs text-foreground"
            title={address ?? ""}>
            {address ?? "—"}
          </code>
          <button id="copy-address-btn" onClick={copyAddress}
            aria-label="Copy wallet address" title="Copy address"
            className="flex items-center rounded-lg border border-border bg-muted p-2 text-muted-foreground transition hover:border-foreground/25 hover:text-foreground cursor-pointer">
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
        </div>
      </div>

      {/* CELO Balance */}
      <div className="flex flex-col gap-1.5 mb-4">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          CELO Balance
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl text-accent">
            {formatBalance(balance)}
          </span>
          <span className="text-sm text-muted-foreground">CELO</span>
        </div>
      </div>

      {/* Profile stats */}
      {isAuthenticated && user && (
        <>
          <div className="h-px bg-border mb-4" aria-hidden="true" />
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Profile
            </span>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "ELO",     value: user.elo },
                { label: "Wins",    value: user.wins },
                { label: "Losses",  value: user.losses },
                { label: "Matches", value: user.matchesPlayed },
              ].map((stat) => (
                <div key={stat.label}
                  className="flex flex-col items-center gap-0.5 rounded-lg bg-surface py-2.5">
                  <span className="text-lg text-foreground">{stat.value}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
