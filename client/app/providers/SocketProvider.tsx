"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "../hooks/useAuth";
import { createGameSocket, type GameSocket } from "../lib/socket";

export type SocketStatus = "idle" | "connecting" | "connected" | "error";

export interface SocketContextValue {
  socket: GameSocket | null;
  status: SocketStatus;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function useSocketContext(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocketContext must be used inside SocketProvider");
  return ctx;
}

/**
 * Owns a single Socket.IO connection for the whole authenticated session.
 *
 * Living above the router means the same socket persists across page
 * navigations (matchmaking → game), so the socket id the server stores at
 * queue time stays valid for match/escrow/game events. All hooks share it.
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { token, isAuthenticated, logout } = useAuth();
  const socketRef = useRef<GameSocket | null>(null);
  const [socket, setSocket] = useState<GameSocket | null>(null);
  const [status, setStatus] = useState<SocketStatus>("idle");

  const teardown = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.off("connect");
      socketRef.current.off("disconnect");
      socketRef.current.off("connect_error");
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setSocket(null);
    setStatus("idle");
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      teardown();
      return;
    }

    // Already connected with a live socket — nothing to do.
    if (socketRef.current?.connected) return;

    const s = createGameSocket(token);
    socketRef.current = s;
    setSocket(s);
    setStatus("connecting");

    s.on("connect", () => setStatus("connected"));
    s.on("disconnect", () => setStatus("idle"));
    s.on("connect_error", (err) => {
      // Expired / invalid JWT — clear the cached token so AuthProvider
      // re-fetches a fresh one on next wallet connection.
      if (err.message === "Invalid or expired token") {
        logout();
      }
      setStatus("error");
    });

    s.connect();

    return teardown;
  }, [isAuthenticated, token, teardown, logout]);

  return (
    <SocketContext.Provider value={{ socket, status }}>
      {children}
    </SocketContext.Provider>
  );
}
