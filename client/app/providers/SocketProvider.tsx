"use client";

import React, {
  createContext,
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
  const { token, isAuthenticated } = useAuth();
  const socketRef = useRef<GameSocket | null>(null);
  const [socket, setSocket] = useState<GameSocket | null>(null);
  const [status, setStatus] = useState<SocketStatus>("idle");

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setStatus("idle");
      }
      return;
    }

    // Already connected with a live socket.
    if (socketRef.current?.connected) return;

    const s = createGameSocket(token);
    socketRef.current = s;
    setSocket(s);
    setStatus("connecting");

    s.on("connect", () => setStatus("connected"));
    s.on("disconnect", () => setStatus("idle"));
    s.on("connect_error", () => setStatus("error"));

    s.connect();

    return () => {
      s.off("connect");
      s.off("disconnect");
      s.off("connect_error");
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
      setStatus("idle");
    };
  }, [isAuthenticated, token]);

  return (
    <SocketContext.Provider value={{ socket, status }}>
      {children}
    </SocketContext.Provider>
  );
}
