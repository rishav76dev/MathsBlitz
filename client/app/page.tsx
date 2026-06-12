"use client";

import Link from "next/link";
import { ConnectWalletButton } from "./components/ConnectWalletButton";
import { WalletStatus } from "./components/WalletStatus";
import { useAuth } from "./hooks/useAuth";

export default function Home() {
  const { isAuthenticated } = useAuth();
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 glass border-b border-border">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground text-base">
              ×
            </div>
            <span className="text-lg">MathsBlitz</span>
          </div>
          <ConnectWalletButton />
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────────────────── */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 pb-20">

        {/* Hero */}
        <section aria-label="MathsBlitz intro" className="flex flex-col items-center text-center py-20 gap-6">
          <span className="inline-block rounded-full border border-accent/30 bg-sage-soft px-4 py-1 text-xs font-medium tracking-wide text-accent">
            Built on Celo · Powered by MiniPay
          </span>
          <h1 className="max-w-2xl text-5xl leading-tight sm:text-6xl">
            Competitive Maths,{" "}
            <span className="text-accent">On-Chain.</span>
          </h1>
          <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
            Challenge players to real-time arithmetic duels. Winner takes the Blitz
            stake. Connect your MiniPay wallet to get started.
          </p>
          {isAuthenticated ? (
            <Link
              href="/matchmaking"
              id="play-now-btn"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-base text-primary-foreground shadow-lg transition hover:-translate-y-0.5"
            >
              Play Now →
            </Link>
          ) : (
            <ConnectWalletButton />
          )}
        </section>

        {/* Wallet status card */}
        <section aria-label="Wallet details" className="flex justify-center mb-14">
          <WalletStatus />
        </section>

        {/* Feature grid */}
        <section aria-label="Features" className="grid gap-5 sm:grid-cols-3">
          {[
            { icon: "⚡", title: "Real-time duels",   body: "Race to solve arithmetic problems faster than your opponent." },
            { icon: "💸", title: "Blitz stakes",        body: "Put skin in the game. Wager Blitz — winner takes 95% of the pot." },
            { icon: "🏆", title: "ELO ranking",        body: "Climb the global leaderboard with every win." },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border bg-card p-6 transition hover:border-accent/40 hover:shadow-sm"
            >
              <span className="mb-3 block text-2xl" aria-hidden="true">{f.icon}</span>
              <h2 className="mb-2 text-sm font-medium text-foreground">{f.title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
