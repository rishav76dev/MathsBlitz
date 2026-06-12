"use client";

import { useSocketContext, type SocketStatus } from "../providers/SocketProvider";

export type { SocketStatus };

/**
 * Access the shared Socket.IO connection.
 *
 * The connection itself is owned by SocketProvider (one per authenticated
 * session, persistent across navigation). All consumers — matchmaking, escrow
 * staking, and gameplay — share the same socket so server-side socket-id
 * routing stays valid throughout a match.
 */
export function useSocket() {
  return useSocketContext();
}
