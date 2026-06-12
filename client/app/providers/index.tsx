"use client";

import React from "react";
import { WalletProvider } from "./WalletProvider";
import { AuthProvider } from "./AuthProvider";
import { SocketProvider } from "./SocketProvider";
import { UsernamePrompt } from "../components/UsernamePrompt";

/**
 * Combined provider tree.
 * Order matters: AuthProvider depends on WalletProvider, and SocketProvider
 * depends on AuthProvider (it connects once the user is authenticated).
 *
 * UsernamePrompt is rendered globally so it overlays right after sign-in,
 * regardless of which page the user is on.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <AuthProvider>
        <SocketProvider>
          {children}
          <UsernamePrompt />
        </SocketProvider>
      </AuthProvider>
    </WalletProvider>
  );
}
