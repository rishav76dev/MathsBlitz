"use client";

import { useState, useCallback } from "react";
import { useWallet } from "../hooks/useWallet";
import { useAuth } from "../hooks/useAuth";
import {
  RiFileCopyLine,
  RiCheckLine,
  RiWallet3Fill,
  RiTrophyFill,
  RiCloseLine,
  RiGameFill,
} from "react-icons/ri";

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

  const dotColor =
    status === "connected"
      ? "bg-accent shadow-[0_0_6px_var(--color-accent)]"
      : status === "connecting"
      ? "bg-[var(--sand)] animate-pulse"
      : "bg-destructive";

  const stats = [
    { label: "Wins",    value: user?.wins ?? 0,          icon: RiTrophyFill,  color: "text-primary" },
    { label: "Losses",  value: user?.losses ?? 0,        icon: RiCloseLine,   color: "text-destructive" },
    { label: "Matches", value: user?.matchesPlayed ?? 0, icon: RiGameFill, color: "text-muted-foreground" },
  ];

  return (
    <div
      role="region"
      aria-label="Wallet status"
      className="w-full max-w-md rounded-2xl border border-border bg-card p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <RiWallet3Fill size={15} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${dotColor}`} aria-hidden="true" />
            <span className="text-sm font-medium text-foreground">
              {isAuthenticated ? "Authenticated" : "Connected"}
            </span>
          </div>
        </div>
        {chainName && (
          <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
            {chainName}
          </span>
        )}
      </div>

      <div className="h-px bg-border mb-4" aria-hidden="true" />

      {/* Address */}
      <div className="flex flex-col gap-1.5 mb-4">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Wallet Address
        </span>
        <div className="flex items-center gap-2">
          <code
            className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-lg bg-surface border border-border px-3 py-2 font-mono-game text-xs text-foreground"
            title={address ?? ""}
          >
            {address ?? "—"}
          </code>
          <button
            id="copy-address-btn"
            onClick={copyAddress}
            aria-label="Copy wallet address"
            title="Copy address"
            className="flex items-center rounded-lg border border-border bg-surface p-2 text-muted-foreground transition hover:border-primary/30 hover:text-primary cursor-pointer"
          >
            {copied ? <RiCheckLine size={13} className="text-accent" /> : <RiFileCopyLine size={13} />}
          </button>
        </div>
      </div>

      {/* CELO Balance */}
      <div className="flex flex-col gap-1.5 mb-4">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          CELO Balance
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-3xl font-bold text-primary">
            {formatBalance(balance)}
          </span>
          <span className="text-sm text-muted-foreground">CELO</span>
        </div>
      </div>

      {/* Profile stats */}
      {isAuthenticated && user && (
        <>
          <div className="h-px bg-border mb-4" aria-hidden="true" />
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Profile
            </span>
            <div className="grid grid-cols-3 gap-2">
              {stats.map((s) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.label}
                    className="flex flex-col items-center gap-1 rounded-xl bg-surface border border-border py-3"
                  >
                    <Icon size={14} className={s.color} />
                    <span className="font-display text-xl font-bold text-foreground">{s.value}</span>
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
