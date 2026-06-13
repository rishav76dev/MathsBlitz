import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { celoSepolia } from "viem/chains";
import { http } from "wagmi";

export const wagmiConfig = getDefaultConfig({
  appName: "MathsBlitz",
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "mathsblitzdemo000000000000000000",
  chains: [celoSepolia],
  transports: {
    [celoSepolia.id]: http("https://forno.celo-sepolia.celo-testnet.org"),
  },
  ssr: true,
});

export const CELO_CHAIN = celoSepolia;
export const CELO_CHAIN_ID = celoSepolia.id;

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
