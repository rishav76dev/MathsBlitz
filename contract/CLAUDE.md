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

# Deploy to Alfajores
PRIVATE_KEY=0x... TREASURY_ADDRESS=0x... AUTHORIZED_SIGNER=0x... \
  forge script script/DeployEscrow.s.sol:DeployEscrow \
  --rpc-url https://alfajores-forno.celo-testnet.org --broadcast
```

## Contract: `MathsBlitzEscrow`

Single contract (`src/MathsBlitzEscrow.sol`). Inherits `Ownable`, `Pausable`, `ReentrancyGuard` from OpenZeppelin.

**Lifecycle**: `NonExistent → Open → Active → Settled | Cancelled`

| Function | Who | Effect |
|---|---|---|
| `createMatch(matchId)` | player1 | Opens match, locks wager in CELO |
| `joinMatch(matchId)` | player2 | Matches exact wager, moves to Active |
| `settleMatch(matchId, winner, sig)` | backend signer (or owner) | Pays 95% to winner, 5% to treasury |
| `cancelMatch(matchId)` | player1 or owner | Refunds player1's stake (Open only) |

**Settlement signature**: the backend must sign `keccak256(abi.encodePacked(matchId, winner, address(this), block.chainid))` and the contract wraps it with `MessageHashUtils.toEthSignedMessageHash` before ECDSA recovery. Replay protection uses `_usedSettlements[digest]`.

**Wager currency**: native CELO only (no ERC-20). All values in wei (18 decimals, same as ETH).

## Libraries

- `lib/openzeppelin-contracts` — OZ v5.x via Foundry
- `lib/forge-std` — test helpers

Remappings (in `foundry.toml`):
- `@openzeppelin/contracts/` → `lib/openzeppelin-contracts/contracts/`
- `forge-std/` → `lib/forge-std/src/`
