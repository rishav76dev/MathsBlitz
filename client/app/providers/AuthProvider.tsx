"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useWalletContext } from "./WalletProvider";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  walletAddress: string;
  username: string | null;
  wins: number;
  losses: number;
  matchesPlayed: number;
}

export type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

export interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  needsUsername: boolean;
  logout: () => void;
  setUsername: (username: string) => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────
export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used inside AuthProvider");
  return ctx;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TOKEN_KEY = "mathsblitz_jwt";
const USER_KEY = "mathsblitz_user";

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const wallet = useWalletContext();

  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("idle");

  // ── Auto-authenticate from wallet connection (no signature required) ───────
  useEffect(() => {
    if (wallet.isConnected && wallet.address) {
      // Try to restore a saved session for this address first
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser) as AuthUser;
          if (parsed.walletAddress.toLowerCase() === wallet.address.toLowerCase()) {
            if (storedToken) {
              // Full cached session — no server round-trip needed.
              setToken(storedToken);
              setUser(parsed);
              setStatus("authenticated");
              return;
            }
            // User cached but no token (server was down last time) — restore the
            // user optimistically so the UI is responsive, then fetch a fresh token.
            setUser(parsed);
          }
        } catch {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
        }
      }
      // Fetch profile / fresh token from backend.
      setStatus("loading");
      fetch(`${API_BASE}/auth/profile?address=${wallet.address}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.user) {
            setUser(data.user as AuthUser);
            if (data.token) {
              setToken(data.token);
              localStorage.setItem(TOKEN_KEY, data.token);
              localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            }
          } else {
            // Backend unavailable or new user — still mark as authenticated by wallet
            setUser({
              id: wallet.address!,
              walletAddress: wallet.address!,
              username: null,
              wins: 0,
              losses: 0,
              matchesPlayed: 0,
            });
          }
          setStatus("authenticated");
        })
        .catch(() => {
          // Backend down — still authenticated by wallet connection alone
          setUser({
            id: wallet.address!,
            walletAddress: wallet.address!,
            username: null,
            wins: 0,
            losses: 0,
            matchesPlayed: 0,
          });
          setStatus("authenticated");
        });
    } else if (!wallet.isConnected) {
      setStatus("unauthenticated");
    }
  }, [wallet.isConnected, wallet.address]);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  // ── Set username ──────────────────────────────────────────────────────────
  const setUsername = useCallback(
    async (username: string) => {
      // Try backend if we have a token; fall back to local-only when offline
      if (token) {
        const res = await fetch(`${API_BASE}/auth/username`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ username }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error || "Could not set username.");
        }
        const { user: updated } = (await res.json()) as { user: AuthUser };
        localStorage.setItem(USER_KEY, JSON.stringify(updated));
        setUser(updated);
        return;
      }
      // No token (wallet-only auth) — persist locally
      setUser((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, username };
        localStorage.setItem(USER_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    [token]
  );

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        status,
        isAuthenticated: status === "authenticated",
        needsUsername: status === "authenticated" && !!user && !user.username,
        logout,
        setUsername,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
