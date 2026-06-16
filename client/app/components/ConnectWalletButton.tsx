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
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border-2 border-border"
          style={{ background: "#2D6A4F", color: "#FCFF52" }}
        >
          <RiShieldCheckFill size={12} />
          Connected
        </span>
        <span className="font-mono-game text-xs hidden sm:inline" style={{ color: "#2D6A4F" }} title={address!}>
          {truncateAddress(address!)}
        </span>
        <button
          id="disconnect-btn"
          onClick={handleLogout}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold border-2 border-border transition cursor-pointer"
          style={{ background: "transparent", color: "#2D6A4F" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#2D6A4F22")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          Disconnect
        </button>
      </div>
    );
  }

  if (isConnected && status === "loading") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface border-2 border-border px-3 py-1.5 text-xs text-muted-foreground">
        <RiLoader4Line size={14} className="animate-spin" />
        Connecting…
      </span>
    );
  }

  return <WalletButton />;
}
