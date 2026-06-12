"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useAccount, useBalance, useDisconnect, useSignMessage } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { formatUnits } from "viem";
import { wagmiConfig } from "../lib/wagmi";
import { useMiniPay } from "../hooks/useMiniPay";

import "@rainbow-me/rainbowkit/styles.css";

// ─── Types ────────────────────────────────────────────────────────────────────
export type WalletStatus = "idle" | "connecting" | "connected" | "error";
export type WalletError = "NOT_INSTALLED" | "USER_REJECTED" | "WRONG_NETWORK" | "UNKNOWN";

export interface WalletState {
  address: string | null;
  chainId: number | null;
  chainName: string | null;
  balance: string | null;
  isConnected: boolean;
  isMiniPay: boolean;
  status: WalletStatus;
  error: WalletError | null;
  errorMessage: string | null;
}

export interface WalletContextValue extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  signMessage: (message: string) => Promise<`0x${string}`>;
}

// ─── Context ──────────────────────────────────────────────────────────────────
export const WalletContext = createContext<WalletContextValue | null>(null);

export function useWalletContext(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWalletContext must be used inside WalletProvider");
  return ctx;
}

// ─── Inner provider (uses wagmi hooks) ────────────────────────────────────────
function InnerWalletProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected, chain, chainId } = useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { data: balanceData } = useBalance({ address });
  const { isMiniPay } = useMiniPay();

  const signMessage = useCallback(
    async (message: string): Promise<`0x${string}`> => {
      return await signMessageAsync({ message });
    },
    [signMessageAsync]
  );

  const disconnect = useCallback(() => {
    wagmiDisconnect();
  }, [wagmiDisconnect]);

  // Connection is opened via WalletButton / RainbowKit modal — this is a no-op stub
  // kept so AuthProvider and other consumers don't need changes.
  const connect = useCallback(async () => {}, []);

  const balance = balanceData
    ? formatUnits(balanceData.value, balanceData.decimals)
    : null;

  const value: WalletContextValue = {
    address: address ?? null,
    chainId: chainId ?? null,
    chainName: chain?.name ?? null,
    balance,
    isConnected,
    isMiniPay,
    status: isConnected ? "connected" : "idle",
    error: null,
    errorMessage: null,
    connect,
    disconnect,
    signMessage,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

// ─── Outer provider (sets up wagmi + RainbowKit) ──────────────────────────────
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "var(--color-accent)",
            borderRadius: "large",
          })}
        >
          <InnerWalletProvider>{children}</InnerWalletProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
