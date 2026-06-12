// 1000 Blitz = 1 CELO — conversion for UI display only.
// All on-chain and socket values remain in CELO.

export const BLITZ_PER_CELO = 1000;

export function celoToBlitz(celo: number): number {
  return celo * BLITZ_PER_CELO;
}

export function formatBlitz(celo: number): string {
  const blitz = celoToBlitz(celo);
  return blitz.toLocaleString("en-US");
}
