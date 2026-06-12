"use client";

import React from "react";
import { useAuth } from "../hooks/useAuth";
import { ConnectWalletButton } from "./ConnectWalletButton";

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { isAuthenticated, status } = useAuth();

  if (status === "idle" || status === "loading") {
    return (
      <div aria-busy="true" aria-label="Checking authentication…"
        className="flex flex-col items-center justify-center gap-3 min-h-[200px]">
        <span aria-hidden="true"
          className="size-8 rounded-full border-2 border-white/10 border-t-green-400 animate-spin block" />
        <span className="text-sm text-zinc-500">Loading…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return fallback ?? (
      <div role="main" aria-label="Sign in required"
        className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="flex flex-col items-center gap-4 text-center rounded-2xl border border-white/8 bg-zinc-900 p-10 max-w-sm w-full shadow-xl shadow-black/40">
          <h2 className="text-xl font-bold text-zinc-100">Sign in to continue</h2>
          <p className="text-sm text-zinc-500 leading-relaxed">
            Connect your MiniPay wallet and sign in to access this page.
          </p>
          <ConnectWalletButton />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
