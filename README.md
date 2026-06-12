# MathsBlitz

Real-time 2-player arithmetic duels with native-CELO wagering on the Celo blockchain. Connect a MiniPay wallet, enter a wager tier, and race your opponent to answer maths questions. Winner takes 95% of the pot.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind 4, RainbowKit/wagmi, viem |
| Backend | Node.js, Express 5, Socket.IO 4, Mongoose |
| Smart contract | Solidity 0.8.24, Foundry, OpenZeppelin v5 |
| Chain | Celo (mainnet) / Celo Alfajores (testnet) |
| DB | MongoDB |

## Project structure

```
mathsBlitz/
├── client/     Next.js frontend
├── contract/   MathsBlitzEscrow Solidity contract
└── server/     Express + Socket.IO backend
```

## Quick start

### 1. Contract

```bash
cd contract
forge build
forge test
```

Deploy to Alfajores:

```bash
PRIVATE_KEY=0x... TREASURY_ADDRESS=0x... AUTHORIZED_SIGNER=0x... \
  forge script script/DeployEscrow.s.sol:DeployEscrow \
  --rpc-url https://alfajores-forno.celo-testnet.org --broadcast
```

### 2. Server

```bash
cd server
cp .env.example .env   # fill in values
npm install
npm run dev            # :4000
```

Minimum `.env`:
```
MONGODB_URI=mongodb://localhost:27017/mathsblitz
JWT_SECRET=<long-random-string>
CLIENT_URL=http://localhost:3000
```

Add `ESCROW_CONTRACT_ADDRESS` and `SETTLEMENT_PRIVATE_KEY` to enable on-chain wagering. Without them the server runs in escrow-disabled mode — matches start immediately with no staking.

### 3. Client

```bash
cd client
cp .env.local.example .env.local   # or create manually
npm install
npm run dev                         # :3000
```

Minimum `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Add `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` for WalletConnect support (optional for local MiniPay testing).

## How it works

1. **Auth** — wallet address is sent to `GET /auth/profile`, the server upserts the user and returns a JWT used for all subsequent API and socket calls.
2. **Matchmaking** — client joins a wager-tier queue via Socket.IO; the server pairs two players and sends each a `match_found` event.
3. **Staking** (escrow-enabled only) — the creator calls `createMatch` on-chain, then the joiner calls `joinMatch`. The server verifies both stakes on-chain before releasing the game.
4. **Game** — 30-second blitz; arithmetic questions are served every 6 seconds (sooner on a correct answer). Answers are scored server-side.
5. **Settlement** — on game end the server signs the settlement digest with `SETTLEMENT_PRIVATE_KEY` and submits `settleMatch` to the contract. The winner receives 95% of the pot; a 5% treasury fee is retained.

## Smart contract

`MathsBlitzEscrow` — single non-upgradeable contract on Celo.

- Native CELO escrow (no ERC-20).
- Settlement requires an ECDSA signature from the authorised signer, binding `matchId + winner + contractAddress + chainId` to prevent replay across chains/contracts.
- Owner can pause the contract and update treasury/signer addresses.

## Wager tiers

`0.5 / 1 / 2 / 5 CELO` — players are only matched within the same tier.

## ELO & stats

Win/loss/ELO are tracked per user in MongoDB. ELO updates are handled server-side on match completion.
