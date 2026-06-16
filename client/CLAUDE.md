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
- Drives the pre-queue staking lifecycle.
- State machine: `idle → requesting → ready_to_stake → staking → confirming → queued → withdrawing → withdrawn | error`.
- `stake()`: ABI-encodes `depositStake(reservationId)`, sends via MiniPay or wagmi, waits for receipt, emits `confirm_stake`.
- `withdraw()`: emits `leave_queue` — no user transaction required. The server calls `serverWithdrawStake` on the contract using its own wallet key, and the player's stake is returned automatically. The hook transitions to `withdrawn` on the `queue_left` server event.

**Matchmaking hook** (`useMatchmaking`):
- Tracks queue/match state independently of staking.
- Exposes: `queueStatus` (`"idle" | "queuing" | "matched"`), `selectedWager`, `matchFound`, `setSelectedWager`, `leaveQueue`, `reset`.
- Listens for `queue_joined`, `queue_left`, `match_found` to update `queueStatus` and surface `matchFound` for navigation.

**Game hook** (`useGame`):
- Listens for `game_started`, `new_question`, `score_update`, `game_ended`, `settlement_update`.
- Tracks current question, scores, timer, and settlement result.

**Escrow utilities** (`lib/escrow.ts`):
- `wagerToWei`: converts CELO amount (number) → bigint wei using integer milli-CELO arithmetic (avoids float drift).
- `encodeDepositStake`: ABI-encodes `depositStake(bytes32)`.
- `getPublicClient(chainId)`: returns a viem public client for receipt polling.

## Pages

| Route | File | Purpose |
|---|---|---|
| `/` | `app/page.tsx` | Landing / connect wallet |
| `/matchmaking` | `app/matchmaking/page.tsx` | Queue + escrow staking UI |
| `/game/[matchId]` | `app/game/[matchId]/page.tsx` | Live match |
