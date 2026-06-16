"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useSwitchChain } from "wagmi";
import { CELO_CHAIN_ID } from "../lib/wagmi";
import { useMiniPay } from "../hooks/useMiniPay";

export function WalletButton({ size = "md" }: { size?: "sm" | "md" }) {
  const { isMiniPay } = useMiniPay();
  const { switchChain } = useSwitchChain();
  const pad = size === "sm" ? "px-4 py-2 text-xs" : "px-5 py-2.5 text-sm";

  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        if (!ready) {
          return (
            <div aria-hidden className={`${pad} pointer-events-none opacity-0`}>
              …
            </div>
          );
        }

        if (isMiniPay && connected) return null;

        if (!connected) {
          return (
            <button
              onClick={openConnectModal}
              className={`inline-flex items-center gap-2 rounded-lg font-bold border-2 border-border cursor-pointer transition ${pad}`}
              style={{ background: "#2D6A4F", color: "#FCFF52", boxShadow: "3px 3px 0 #1A1E1B" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translate(-1px,-1px)"; e.currentTarget.style.boxShadow = "4px 4px 0 #1A1E1B"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "3px 3px 0 #1A1E1B"; }}
            >
              Connect Wallet
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              onClick={() => switchChain({ chainId: CELO_CHAIN_ID })}
              className={`inline-flex items-center rounded-lg font-bold border-2 border-border cursor-pointer ${pad}`}
              style={{ background: "#C93625", color: "#fff", boxShadow: "3px 3px 0 #1A1E1B" }}
            >
              Switch to Celo
            </button>
          );
        }

        return (
          <button
            onClick={openAccountModal}
            className={`inline-flex items-center gap-2 rounded-lg font-semibold border-2 border-border cursor-pointer ${pad}`}
            style={{ background: "#2D6A4F22", color: "#2D6A4F" }}
          >
            <span className="h-2 w-2 rounded-full bg-accent" />
            {account.displayName}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
