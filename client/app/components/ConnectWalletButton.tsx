"use client";

import { useWallet } from "../hooks/useWallet";
import { useAuth } from "../hooks/useAuth";
import { WalletButton } from "./WalletButton";

function SpinnerIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
      aria-hidden="true" className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function ConnectWalletButton() {
  const { address, isConnected, disconnect } = useWallet();
  const { isAuthenticated, logout, status } = useAuth();

  const handleLogout = () => { logout(); disconnect(); };

  // ── Fully authenticated ────────────────────────────────────────────────────
  if (isConnected && isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-soft border border-accent/25 px-3 py-1 text-xs text-accent">
          ● Connected
        </span>
        <span className="font-mono text-xs text-muted-foreground" title={address!}>
          {truncateAddress(address!)}
        </span>
        <button id="disconnect-btn" onClick={handleLogout}
          className="rounded-md border border-border bg-transparent px-3 py-1.5 text-xs text-muted-foreground transition hover:border-foreground/30 hover:text-foreground cursor-pointer">
          Disconnect
        </button>
      </div>
    );
  }

  // ── Connected, loading auth ────────────────────────────────────────────────
  if (isConnected && status === "loading") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface border border-border px-3 py-1.5 text-xs text-muted-foreground">
        <SpinnerIcon />Connecting…
      </span>
    );
  }

  // ── Not connected ─────────────────────────────────────────────────────────
  return <WalletButton />;
}
