# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Warning**: This project uses Next.js 16 and React 19 — APIs and conventions differ from older versions. Check `node_modules/next/dist/docs/` before writing any Next.js-specific code.

## Commands

```bash
# Development
npm run dev          # Next.js dev server on :3000

# Build / lint
npm run build
npm run lint         # ESLint (eslint.config.mjs, flat config)
```

No test runner is configured.

## Environment

Copy `.env.local` and set:
```
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
```

## Architecture

**Providers** (`app/providers/index.tsx`): `WalletProvider` (wagmi + RainbowKit) → `AuthProvider` → `SocketProvider`. Each must be mounted in that order.

**Wallet layer** (`useWallet`, `WalletProvider`):
- RainbowKit/wagmi wraps `celo` mainnet only (see `lib/wagmi.ts`).
- `useMiniPay` detects the MiniPay in-app browser and exposes `window.ethereum` as a raw provider for direct `eth_sendTransaction` calls (bypasses wagmi's write API).
- Escrow transactions are sent through the MiniPay provider, not wagmi hooks.

**Auth** (`AuthProvider`, `useAuth`):
- On wallet connect, calls `GET /auth/profile?address=<wallet>` to upsert user and receive a JWT.
- JWT is stored in component state (not localStorage) and attached to every Socket.IO connection as `auth.token`.
- `ProtectedRoute` redirects to home if `!isAuthenticated`.

**Socket** (`SocketProvider`, `useSocket`):
- Single `socket.io-client` instance created after auth; reconnects automatically.
- `useSocket` exposes `socket` and `isConnected`.

**Escrow hook** (`useEscrow`):
- Drives the full staking lifecycle for a matched game.
- State machine: `awaiting_creator → ready_to_stake → staking → confirming → waiting_opponent → ready` (creator) or `awaiting_creator → ready_to_stake → staking → confirming → ready` (joiner).
- Calls `encodeStakeCall` from `lib/escrow.ts` to ABI-encode `createMatch` / `joinMatch`, then sends via MiniPay provider.
- After tx mines, emits `confirm_stake` to server.

**Game hook** (`useGame`):
- Listens for `game_started`, `new_question`, `score_update`, `game_ended`, `settlement_update`.
- Tracks current question, scores, timer, and settlement result.

**Escrow utilities** (`lib/escrow.ts`):
- `wagerToWei`: converts CELO amount (number) → bigint wei using integer milli-CELO arithmetic (avoids float drift).
- `encodeStakeCall`: ABI-encodes `createMatch(bytes32)` or `joinMatch(bytes32)`.
- `encodeCancelCall`: ABI-encodes `cancelMatch(bytes32)` for creator refund.
- `getPublicClient(chainId)`: returns a viem public client for receipt polling.

## Pages

| Route | File | Purpose |
|---|---|---|
| `/` | `app/page.tsx` | Landing / connect wallet |
| `/matchmaking` | `app/matchmaking/page.tsx` | Queue + escrow staking UI |
| `/game/[matchId]` | `app/game/[matchId]/page.tsx` | Live match |
