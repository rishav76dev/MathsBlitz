"use client";

import Link from "next/link";
import Image from "next/image";
import { ConnectWalletButton } from "./components/ConnectWalletButton";
import { WalletStatus } from "./components/WalletStatus";
import { useAuth } from "./hooks/useAuth";
import { RiFlashlightFill, RiSwordFill, RiCoinsFill, RiTrophyFill } from "react-icons/ri";

const features = [
  {
    icon: RiSwordFill,
    num: "01",
    title: "Real-time duels",
    body: "Race to solve arithmetic problems faster than your opponent in live head-to-head matches.",
  },
  {
    icon: RiCoinsFill,
    num: "02",
    title: "Blitz stakes",
    body: "Put skin in the game. Wager CELO — winner takes 95% of the pot, settled on-chain instantly.",
  },
  {
    icon: RiTrophyFill,
    num: "03",
    title: "Win streaks",
    body: "Track your wins, losses, and matches played. Climb the global leaderboard.",
    comingSoon: true,
  },
];

const steps = [
  {
    n: "01",
    title: "Connect Wallet",
    body: "Link MiniPay or any Web3 wallet. Your wallet is your identity.",
  },
  {
    n: "02",
    title: "Pick a Wager",
    body: "Set your CELO stake — 0.5, 1, 2, or 5. Locked on-chain before the duel.",
  },
  {
    n: "03",
    title: "Math Duel",
    body: "30 seconds. Five arithmetic blitzes. Race your live opponent.",
  },
  {
    n: "04",
    title: "Win & Collect",
    body: "Winner takes 95% of the pot. Settled on-chain, instantly.",
  },
];

export default function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* ── Header ─────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 border-b-2 border-border"
        style={{ background: "#FCFF52" }}
      >
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="MathsBlitz logo"
              width={52}
              height={52}
            />
            <span className="font-display text-lg font-bold tracking-tight" style={{ color: "#2D6A4F" }}>
              MathsBlitz
            </span>
          </div>
          <ConnectWalletButton />
        </div>
      </header>

      {/* ── Main ───────────────────────────────────── */}
      <main className="mx-auto w-full max-w-5xl flex-1 flex flex-col px-6">

        {/* ── Hero ─────────────────────────────────── */}
        <section
          aria-label="MathsBlitz intro"
          className="flex flex-col items-center text-center py-20 gap-7"
        >
          {/* Badge */}
          <span className="neo-badge bg-primary text-prosperity">
            <RiFlashlightFill size={10} style={{ display: "inline", marginRight: 6 }} />
            Built on Celo · Powered by MiniPay
          </span>

          {/* Headline */}
          <h1 className="font-display max-w-2xl text-5xl font-extrabold leading-[1.08] tracking-tight sm:text-7xl text-foreground">
            Competitive Maths,{" "}
            <span
              className="inline bg-prosperity border-2 border-border px-2"
              style={{ boxShadow: "5px 5px 0 #2D8653" }}
            >
              On-Chain.
            </span>
          </h1>

          <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
            Challenge players to real-time arithmetic duels. Winner takes the Blitz
            stake. Connect your MiniPay wallet to get started.
          </p>

          {/* CTA */}
          {isAuthenticated ? (
            <Link
              href="/matchmaking"
              id="play-now-btn"
              className="neo-btn-primary gap-2.5 px-9 py-4 text-base"
            >
              <RiFlashlightFill size={18} />
              Play Now
            </Link>
          ) : (
            <ConnectWalletButton />
          )}
        </section>

        {/* ── Wallet status ─────────────────────────── */}
        <section aria-label="Wallet details" className="flex justify-center mb-20">
          <WalletStatus />
        </section>

        {/* ── Section label ─────────────────────────── */}
        <div className="mb-7 flex items-center gap-4">
          <span className="neo-badge bg-primary text-prosperity">Why play</span>
          <div className="flex-1 h-0.5 bg-border opacity-15 rounded-full" />
        </div>

        {/* ── Feature cards ─────────────────────────── */}
        <section aria-label="Features" className="grid gap-5 sm:grid-cols-3 mb-24">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className={`neo-card p-6 relative${f.comingSoon ? " opacity-70" : ""}`}>
                {f.comingSoon && (
                  <span className="absolute top-4 right-4 font-mono-game text-[10px] tracking-[0.14em] font-bold px-2 py-0.5 rounded-md border-2 border-border bg-prosperity text-foreground">
                    COMING SOON
                  </span>
                )}
                <div className="mb-4 flex items-center justify-between">
                  <div
                    className="flex size-11 items-center justify-center rounded-xl bg-prosperity border-2 border-border"
                    style={{ boxShadow: "2px 2px 0 #2D6A4F" }}
                  >
                    <Icon size={20} className="text-foreground" />
                  </div>
                  <span className="font-mono-game text-[32px] font-bold leading-none select-none text-foreground opacity-5">
                    {f.num}
                  </span>
                </div>
                <h2 className="mb-2 font-display text-base font-bold text-foreground">
                  {f.title}
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            );
          })}
        </section>

        {/* ── Section label ─────────────────────────── */}
        <div className="mb-7 flex items-center gap-4">
          <span className="neo-badge bg-primary text-prosperity">How it works</span>
          <div className="flex-1 h-0.5 bg-border opacity-15 rounded-full" />
        </div>

        {/* ── How it works ──────────────────────────── */}
        <section
          aria-label="How it works"
          className="rounded-2xl mb-24 overflow-hidden border-2 border-border"
          style={{ boxShadow: "6px 6px 0 #2D8653" }}
        >
          {/* Dark header strip */}
          <div className="px-7 py-4 bg-primary flex items-center gap-3 border-b-2 border-border">
            <span className="font-display text-base font-bold text-prosperity">
              Four steps. Zero fluff.
            </span>
          </div>

          {/* Steps grid */}
          <div className="grid sm:grid-cols-4 bg-card divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-border/20">
            {steps.map((s, i) => (
              <div key={s.n} className="px-6 py-7 flex flex-col gap-3 bg-card">
                <span className="font-mono-game text-[11px] tracking-[0.18em] text-primary font-bold">
                  STEP {s.n}
                </span>
                <h3 className="font-display text-[15px] font-bold text-foreground">
                  {s.title}
                </h3>
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Bottom CTA ────────────────────────────── */}
        <div className="flex justify-center mb-24">
          {isAuthenticated ? (
            <Link
              href="/matchmaking"
              className="neo-btn-primary gap-2 px-8 py-3.5 text-sm"
            >
              <RiFlashlightFill size={15} />
              Start your first duel
            </Link>
          ) : (
            <ConnectWalletButton />
          )}
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────── */}
      <footer className="bg-primary border-t-2 border-border">
        <div className="mx-auto flex h-13 max-w-5xl items-center justify-between px-6 py-3">
          <span className="font-mono-game text-[11px] tracking-[0.18em] text-prosperity opacity-70">
            © 2025 MATHSBLITZ · BUILT ON CELO
          </span>
          <div
            className="flex size-7 items-center justify-center rounded-lg bg-prosperity border-2 border-border"
            style={{ boxShadow: "2px 2px 0 #2D8653" }}
          >
            <RiFlashlightFill size={14} className="text-foreground" />
          </div>
        </div>
      </footer>
    </div>
  );
}
