"use client";

import { useWallet } from "../hooks/useWallet";
import { useAuth } from "../hooks/useAuth";
import { WalletButton } from "./WalletButton";
import { RiLoader4Line, RiWallet3Fill, RiShieldCheckFill } from "react-icons/ri";

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function ConnectWalletButton() {
  const { address, isConnected, disconnect } = useWallet();
  const { isAuthenticated, logout, status } = useAuth();

  const handleLogout = () => { logout(); disconnect(); };

  if (isConnected && isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 border border-accent/20 px-3 py-1 text-xs text-accent font-medium">
          <RiShieldCheckFill size={12} />
          Connected
        </span>
        <span className="font-mono-game text-xs text-muted-foreground hidden sm:inline" title={address!}>
          {truncateAddress(address!)}
        </span>
        <button
          id="disconnect-btn"
          onClick={handleLogout}
          className="rounded-lg border border-border bg-transparent px-3 py-1.5 text-xs text-muted-foreground transition hover:border-foreground/25 hover:text-foreground cursor-pointer"
        >
          Disconnect
        </button>
      </div>
    );
  }

  if (isConnected && status === "loading") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface border border-border px-3 py-1.5 text-xs text-muted-foreground">
        <RiLoader4Line size={14} className="animate-spin" />
        Connecting…
      </span>
    );
  }

  return <WalletButton />;
}
