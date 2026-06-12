"use client";

import { useWalletContext, type WalletContextValue } from "../providers/WalletProvider";

/**
 * Hook to access wallet state and actions.
 *
 * @example
 * const { address, isConnected, connect, balance } = useWallet();
 */
export function useWallet(): WalletContextValue {
  return useWalletContext();
}
