# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Build
forge build

# Test (all)
forge test

# Test (single file / function)
forge test --match-path test/MathsBlitzEscrow.t.sol
forge test --match-test testSettleMatch

# Deploy to Celo mainnet
PRIVATE_KEY=0x... TREASURY_ADDRESS=0x... AUTHORIZED_SIGNER=0x... \
  forge script script/DeployEscrow.s.sol:DeployEscrow \
  --rpc-url https://forno.celo.org --broadcast
```

## Contract: `MathsBlitzEscrow`

Single contract (`src/MathsBlitzEscrow.sol`). Inherits `Ownable`, `Pausable`, `ReentrancyGuard` from OpenZeppelin.

**Lifecycle**: `NonExistent → Active → Settled | Cancelled`

Reservations are created by players via `depositStake` before matching. The server links two reservations into a match with `linkMatch`.

| Function | Who | Effect |
|---|---|---|
| `depositStake(reservationId)` | player | Locks wager in CELO, creates a Reservation |
| `withdrawStake(reservationId)` | player (only) | Reclaims unlinked stake — requires user tx |
| `serverWithdrawStake(reservationId)` | backend signer | Reclaims unlinked stake on player's behalf (no user tx needed — used when player leaves the queue) |
| `linkMatch(matchId, reservA, reservB)` | backend signer | Links two reservations into an Active match |
| `settleMatch(matchId, winner, sig)` | backend signer (or owner) | Pays 95% to winner, 5% to treasury |
| `refundDraw(matchId)` | backend signer | Refunds both players in full when the game ends in a draw |
| `cancelMatch(matchId)` | owner | Emergency refund of an Active match |

**Settlement signature**: the backend must sign `keccak256(abi.encodePacked(matchId, winner, address(this), block.chainid))` and the contract wraps it with `MessageHashUtils.toEthSignedMessageHash` before ECDSA recovery. Replay protection uses `_usedSettlements[digest]`.

**Wager currency**: native CELO only (no ERC-20). All values in wei (18 decimals, same as ETH).

## Libraries

- `lib/openzeppelin-contracts` — OZ v5.x via Foundry
- `lib/forge-std` — test helpers

Remappings (in `foundry.toml`):
- `@openzeppelin/contracts/` → `lib/openzeppelin-contracts/contracts/`
- `forge-std/` → `lib/forge-std/src/`
