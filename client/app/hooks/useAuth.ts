"use client";

import { useAuthContext, type AuthContextValue } from "../providers/AuthProvider";

/**
 * Hook to access authentication state and actions.
 *
 * @example
 * const { isAuthenticated, logout, user, token } = useAuth();
 */
export function useAuth(): AuthContextValue {
  return useAuthContext();
}
