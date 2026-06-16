# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

```
mathsBlitz/
├── client/     Next.js 16 frontend (React 19, TypeScript, Tailwind 4)
├── contract/   Solidity smart contract (Foundry)
└── server/     Node.js backend (Express 5, Socket.IO 4, Mongoose)
```

Each subdirectory has its own `CLAUDE.md` with layer-specific guidance.

## System architecture

MathsBlitz is a real-time 2-player maths quiz with optional native-CELO wagering on the Celo blockchain.

**Auth flow**: wallet address → `GET /auth/profile` → JWT (7d) → stored in client, sent as Socket.IO `auth.token`.

**Matchmaking flow**:
1. Client emits `stake_and_queue` with a wager tier → server returns `reservation_ready`.
2. Client calls `depositStake(reservationId){value: wager}` on-chain, then emits `confirm_stake`.
3. Server verifies on-chain, enqueues player, emits `queue_joined`.
4. `QueueManager` pairs two players → server calls `linkMatch` on-chain → both receive `match_found`.

**Escrow staking flow** (when `ESCROW_ENABLED`):
1. Each player independently calls `depositStake(reservationId){value: wager}` and emits `confirm_stake`.
2. Server verifies each stake on-chain via `EscrowService`, enqueues the player.
3. On match: server calls `linkMatch(matchId, reservA, reservB)` → both stakes locked into the match.
4. On game end: `SettlementService.settle()` submits `settleMatch` (winner) or `refundDraw` (draw) using the server wallet.

**Queue leave** (when `ESCROW_ENABLED`):
- Player emits `leave_queue` (or disconnects). Server calls `serverWithdrawStake(reservationId)` using the server wallet — no second user transaction required. Stake is returned directly to the player's wallet.

**Game flow** (post-staking):
- `GameSession` runs a 30 s blitz: questions broadcast via `new_question` every 6 s (or immediately after a correct answer).
- Clients emit `submit_answer`; server scores in-memory, broadcasts `score_update`.
- On timeout/disconnect, `_endMatch` persists scores to Mongo and triggers settlement.

**Settlement digest** (must match both contract and `SettlementService`):
```
keccak256(abi.encodePacked(matchId, winner, contractAddress, chainId))
```
EIP-191 prefix is added by `MessageHashUtils.toEthSignedMessageHash` in the contract and `account.signMessage({ message: { raw } })` in viem.

## On-chain matchId derivation

The server derives a deterministic `bytes32` on-chain matchId from the Mongo `_id`:
```js
keccak256(stringToHex(`mathsblitz:${dbMatchId}`))
```
Both server and client receive this value in `match_found`; it is the key used in all contract calls.

## Escrow-disabled mode

If `ESCROW_CONTRACT_ADDRESS` or `SETTLEMENT_PRIVATE_KEY` are absent, `ESCROW_ENABLED = false`. The server starts games immediately after matching; no on-chain calls occur. This is the default local-dev path.

## Key data flows between layers

| Event / action | Client | Server | Contract |
|---|---|---|---|
| Request reservation | emit `stake_and_queue` | `createReservation` → `reservation_ready` | — |
| Deposit stake | call `depositStake` | — | locks CELO |
| Stake confirmed | emit `confirm_stake` | `handleStakeConfirmation` → reads chain | — |
| Match found | receive `match_found` | `GameSessionManager.createSession` | `linkMatch` links both reservations |
| Leave queue | emit `leave_queue` | `QueueManager.dequeue` → `serverWithdrawStake` | returns stake to player |
| Game starts | receive `game_started` | `GameSession.start()` | — |
| Answer | emit `submit_answer` | `GameSession.handleAnswer` | — |
| Game ends | receive `game_ended` | `MatchRepository.finalize` | — |
| Settlement (win) | receive `settlement_update` | `SettlementService.settle` | `settleMatch` pays winner |
| Settlement (draw) | receive `settlement_update` | `SettlementService.settle` | `refundDraw` returns both stakes |
