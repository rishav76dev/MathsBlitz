"use client";

import Link from "next/link";
import { ConnectWalletButton } from "./components/ConnectWalletButton";
import { WalletStatus } from "./components/WalletStatus";
import { useAuth } from "./hooks/useAuth";
import { RiFlashlightFill, RiSwordFill, RiCoinsFill, RiTrophyFill } from "react-icons/ri";

const features = [
  {
    icon: RiSwordFill,
    title: "Real-time duels",
    body: "Race to solve arithmetic problems faster than your opponent in live head-to-head matches.",
  },
  {
    icon: RiCoinsFill,
    title: "Blitz stakes",
    body: "Put skin in the game. Wager CELO — winner takes 95% of the pot, settled on-chain instantly.",
  },
  {
    icon: RiTrophyFill,
    title: "Win streaks",
    body: "Track your wins, losses, and matches played. Climb the global leaderboard.",
  },
];

export default function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 glass border-b border-border">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <RiFlashlightFill size={18} />
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-foreground">
              MathsBlitz
            </span>
          </div>
          <ConnectWalletButton />
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────── */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 pb-24">

        {/* Hero */}
        <section
          aria-label="MathsBlitz intro"
          className="flex flex-col items-center text-center py-24 gap-7"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-medium tracking-wide text-primary">
            <RiFlashlightFill size={12} />
            Built on Celo · Powered by MiniPay
          </span>

          <h1 className="font-display max-w-2xl text-5xl font-extrabold leading-[1.1] tracking-tight sm:text-7xl">
            Competitive Maths,{" "}
            <span className="text-primary">On-Chain.</span>
          </h1>

          <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
            Challenge players to real-time arithmetic duels. Winner takes the Blitz
            stake. Connect your MiniPay wallet to get started.
          </p>

          {isAuthenticated ? (
            <Link
              href="/matchmaking"
              id="play-now-btn"
              className="inline-flex items-center gap-2.5 rounded-xl bg-primary px-9 py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:shadow-primary/30 active:scale-95"
            >
              <RiFlaskFill size={18} />
              Play Now
            </Link>
          ) : (
            <ConnectWalletButton />
          )}
        </section>

        {/* Wallet status card */}
        <section aria-label="Wallet details" className="flex justify-center mb-16">
          <WalletStatus />
        </section>

        {/* Feature grid */}
        <section aria-label="Features" className="grid gap-4 sm:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:bg-surface"
              >
                <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary/15">
                  <Icon size={20} />
                </div>
                <h2 className="mb-2 font-display text-base font-semibold text-foreground">
                  {f.title}
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
