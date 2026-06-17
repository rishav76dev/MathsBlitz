import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { celo } from "viem/chains";
import { http } from "wagmi";

export const wagmiConfig = getDefaultConfig({
  appName: "MathsBlitz",
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "mathsblitzdemo000000000000000000",
  chains: [celo],
  transports: {
    [celo.id]: http("https://forno.celo.org"),
  },
  ssr: true,
});

export const CELO_CHAIN = celo;
export const CELO_CHAIN_ID = celo.id;

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
