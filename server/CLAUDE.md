# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev    # nodemon (auto-reload) on :4000
npm start      # node index.js (production)
```

No test runner configured. Copy `.env.example` to `.env` before starting.

## Environment variables

| Var | Required | Default |
|---|---|---|
| `MONGODB_URI` | yes | `mongodb://localhost:27017/mathsblitz` |
| `PORT` | no | 4000 |
| `CLIENT_URL` | no | `http://localhost:3000` |
| `JWT_SECRET` | yes in prod | `change-me-in-production` |
| `CELO_NETWORK` | no | `alfajores` |
| `CELO_RPC_URL` | no | Alfajores forno |
| `ESCROW_CONTRACT_ADDRESS` | optional | enables escrow when set |
| `SETTLEMENT_PRIVATE_KEY` | optional | enables escrow when set |

If `ESCROW_CONTRACT_ADDRESS` or `SETTLEMENT_PRIVATE_KEY` are absent, `ESCROW_ENABLED = false` and all on-chain code is bypassed.

## Architecture

**Entry point**: `index.js` starts Express + Socket.IO on one HTTP server.

**HTTP routes** (`src/auth/`):
- `GET /auth/profile?address=` — upsert user by wallet, return JWT + user object
- `POST /auth/username` (JWT-protected) — set display username

**Socket.IO** (`src/socket/`):
- `socketServer.js` — JWT auth middleware, presence map (`userId → socketId`), delegates to `gameHandlers.js`
- `gameHandlers.js` — handles `join_queue`, `leave_queue`, `confirm_stake`, `submit_answer`, `disconnect`

**Matchmaking** (`src/game/QueueManager.js`):
- In-memory queues keyed by wager tier (0.5 / 1 / 2 / 5 CELO).
- On 2 players in same tier, calls `GameSessionManager.createSession`.

**Session lifecycle** (`src/game/GameSessionManager.js`):
- Creates Mongo match record, derives `onchainMatchId = keccak256(stringToHex("mathsblitz:" + dbMatchId))`.
- Escrow-enabled: emits `match_found` with role/escrow metadata, then waits for `confirm_stake` events; `handleStakeConfirmation` reads chain via `EscrowService` and progresses the state machine.
- Escrow-disabled: starts the `GameSession` after 2 s delay.
- Staking deadline: 120 s; `_expireStaking` cancels the match if not both staked.

**Game** (`src/game/GameSession.js`):
- 30 s match, question every 6 s (reset on correct answer).
- Questions are server-authoritative; answer is stripped before broadcast.
- Per-player answered-set prevents replay attacks on `submit_answer`.
- On end: persists scores to Mongo via `MatchRepository.finalize`, emits `game_ended`, then calls `SettlementService.settle` if escrow enabled.

**Settlement** (`src/services/SettlementService.js`):
- Triple guard against double-settlement: in-memory `_inFlight` set, DB `settlement.status`, on-chain status check.
- Signs `keccak256(encodePacked(matchId, winner, contractAddress, chainId))` with the settlement account, then submits `settleMatch` and waits for receipt.
- Draws: calls `refundDraw(onchainMatchId)` via the server wallet — both players get their full wager back, no user action needed.

**Queue leave / disconnect** (`src/socket/gameHandlers.js`):
- When a queued player emits `leave_queue` or disconnects, `QueueManager.dequeue` returns the queue entry (including `reservationId`).
- If escrow is enabled, `gameHandlers` fires `serverWithdrawStake(reservationId)` on-chain using the server wallet (fire-and-forget). The player's stake is returned to their wallet without requiring a second user-signed transaction.

**Chain clients** (`src/chain/config.js`):
- Lazily creates viem `publicClient` and `walletClient` on first use.
- `deriveOnchainMatchId` and `wagerToWei` must stay in sync with the client-side equivalents in `client/app/lib/escrow.ts`.

## Data models (Mongoose)

**User**: `walletAddress` (unique, lowercase), `username` (unique sparse), `elo`, `wins`, `losses`, `matchesPlayed`.

**Match**: `player1/2` (ObjectId refs), `wager`, `score1/2`, `winner`, `status`, `onchainMatchId`, `escrow.{status, creator, joiner}`, `settlement.{status, txHash, winnerAddress, error}`.
