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
              className={`inline-flex items-center gap-2 rounded-lg bg-primary ${pad} text-primary-foreground shadow-sm transition hover:opacity-90 hover:-translate-y-px`}
            >
              Connect Wallet
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              onClick={() => switchChain({ chainId: CELO_CHAIN_ID })}
              className={`rounded-lg bg-destructive/90 ${pad} text-destructive-foreground transition hover:bg-destructive`}
            >
              Switch to Celo
            </button>
          );
        }

        return (
          <button
            onClick={openAccountModal}
            className={`glass flex items-center gap-2 rounded-full ${pad} text-foreground transition hover:border-accent/50`}
          >
            <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
            {account.displayName}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
