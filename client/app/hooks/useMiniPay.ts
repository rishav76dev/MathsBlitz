"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect } from "wagmi";

export interface MiniPayProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
  isMiniPay?: boolean;
}

export interface UseMiniPayReturn {
  isMiniPay: boolean;
  provider: MiniPayProvider | null;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ethereum?: any;
  }
}

/**
 * Detects MiniPay, auto-connects via wagmi when inside MiniPay,
 * and exposes the raw EIP-1193 provider for direct transaction sending.
 */
export function useMiniPay(): UseMiniPayReturn {
  const [isMiniPay, setIsMiniPay] = useState(false);
  const [provider, setProvider] = useState<MiniPayProvider | null>(null);
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  useEffect(() => {
    const eth = window.ethereum;
    if (!eth?.isMiniPay) return;
    setIsMiniPay(true);
    setProvider(eth as MiniPayProvider);
    if (isConnected) return;
    const injected =
      connectors.find((c) => c.id === "injected") ??
      connectors.find((c) => c.type === "injected") ??
      connectors[0];
    if (injected) connect({ connector: injected });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectors, isConnected]);

  return { isMiniPay, provider };
}
