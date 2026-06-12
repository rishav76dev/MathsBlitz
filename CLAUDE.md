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
1. Client emits `join_queue` with a wager tier (0.5 / 1 / 2 / 5 CELO).
2. `QueueManager` pairs two players and calls `GameSessionManager.createSession`.
3. Both players receive `match_found` with `role: "creator" | "joiner"`, `matchId`, `onchainMatchId`, `contractAddress`.

**Escrow staking flow** (when `ESCROW_ENABLED`):
1. Creator calls `MathsBlitzEscrow.createMatch(onchainMatchId){value: wager}`.
2. Server receives `confirm_stake` → reads chain → emits `escrow_update { escrowStatus: "open" }` to joiner.
3. Joiner calls `joinMatch(onchainMatchId){value: wager}`.
4. Server receives `confirm_stake` again → verifies `Active` state on-chain → emits `escrow_ready` → game starts.
5. On game end `SettlementService.settle()` signs the digest, submits `settleMatch`, and emits `settlement_update`.

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
| Queue entry | emit `join_queue` | `QueueManager.enqueue` | — |
| Match found | receive `match_found` | `GameSessionManager.createSession` | — |
| Creator stakes | call `createMatch` | — | locks CELO |
| Stake confirmed | emit `confirm_stake` | `handleStakeConfirmation` → reads chain | — |
| Joiner stakes | call `joinMatch` | — | match → Active |
| Game starts | receive `game_started` | `GameSession.start()` | — |
| Answer | emit `submit_answer` | `GameSession.handleAnswer` | — |
| Game ends | receive `game_ended` | `MatchRepository.finalize` | — |
| Settlement | receive `settlement_update` | `SettlementService.settle` | `settleMatch` pays winner |
