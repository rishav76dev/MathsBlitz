"use client";

import Image from "next/image";
import Link from "next/link";
import { ConnectWalletButton } from "./components/ConnectWalletButton";
import { WalletButton } from "./components/WalletButton";
import { useAuth } from "./hooks/useAuth";
import {
  RiArrowRightLine,
  RiFlashlightFill,
  RiGroup2Fill,
  RiTrophyFill,
  RiWallet3Fill,
} from "react-icons/ri";

const navItems = [
  { label: "Play", href: "#play", active: true },
  { label: "Leaderboard", href: "#leaderboard" },
  { label: "How it Works", href: "#how-it-works" },
  { label: "Docs", href: "#docs" },
];

const featurePills = [
  {
    icon: RiFlashlightFill,
    label: "30-Second Duels",
  },
  {
    icon: RiGroup2Fill,
    label: "Real-time 1v1 Battles",
  },
  {
    icon: RiTrophyFill,
    label: "Winner Takes 95% of Pot",
  },
];

export default function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7f1e2] text-[#101010]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 12% 18%, rgba(255, 225, 0, 0.10), transparent 20%), radial-gradient(circle at 88% 14%, rgba(202, 232, 111, 0.10), transparent 24%), radial-gradient(circle at 78% 68%, rgba(255, 216, 74, 0.12), transparent 24%), linear-gradient(180deg, #fbf5e7 0%, #f5eedf 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.26]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(176, 181, 125, 0.22) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
          backgroundPosition: "20px 20px",
          maskImage:
            "linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.12) 55%, rgba(0,0,0,0) 100%)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-[1320px] flex-col px-3 pb-4 pt-3 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-3 py-2 sm:gap-4 sm:py-3">
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3">
            <Image
              src="/logo.png"
              alt="MathsBlitz logo"
              width={76}
              height={76}
              className="h-11 w-11 rounded-2xl shadow-[0_10px_24px_rgba(105,112,0,0.18)] sm:h-[76px] sm:w-[76px]"
              priority
            />
            <div className="leading-none">
              <div className="text-[15px] font-black tracking-[-0.06em] sm:text-[24px]">
                MATHS
              </div>
              <div className="text-[15px] font-black italic tracking-[-0.06em] text-[#95b800] sm:text-[24px]">
                BLITZ
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-10 xl:flex">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className={`relative text-[17px] font-semibold tracking-[-0.03em] transition ${
                  item.active ? "text-[#111111]" : "text-[#111111]/90"
                }`}
              >
                {item.label}
                {item.active ? (
                  <span className="absolute -bottom-3 left-0 h-1 w-full rounded-full bg-[#c2d52a]" />
                ) : null}
              </a>
            ))}
          </nav>

          <div className="hidden lg:block">
            <ConnectWalletButton />
          </div>
          <div className="lg:hidden">
            <WalletButton size="sm" />
          </div>
        </header>

        <section
          id="play"
          className="grid flex-1 items-center gap-6 pb-4 pt-3 lg:grid-cols-[0.95fr_1.05fr] lg:gap-8 lg:py-6"
        >
          <div className="relative max-w-full lg:max-w-[640px]">
            <div className="mb-5 inline-flex items-center gap-3 rounded-full border border-[#d9dbc0]/90 bg-[#f6f4e4]/90 px-3 py-2 shadow-[0_10px_30px_rgba(67,70,29,0.06)] backdrop-blur-sm sm:mb-6 sm:gap-4 sm:px-4 sm:py-2.5">
              <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[-0.02em] sm:text-[13px]">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#d8e000] text-[11px] text-[#111111] sm:h-6 sm:w-6 sm:text-[12px]">
                  <RiFlashlightFill />
                </span>
                BUILT ON CELO
              </span>
              <span className="h-5 w-px bg-[#bcbf9a]" />
              <span className="text-[11px] font-semibold tracking-[-0.02em] text-[#4a5038] sm:text-[13px]">
                POWERED BY <span className="text-[#0f2f1d]">MINIPAY</span>
              </span>
            </div>

            <h1
              className="max-w-[680px] text-[clamp(2.2rem,12vw,6.4rem)] font-normal leading-[0.9] tracking-[-0.03em] uppercase text-[#101114] sm:text-[clamp(3rem,6.9vw,6.4rem)]"
              style={{ fontFamily: '"Anton", sans-serif' }}
            >
              <span className="block">RACE.</span>
              <span className="block">SOLVE.</span>
              <span className="block text-[#c9de12]">
                WIN CELO.
                <span className="ml-2 inline-block align-middle text-[#c9de12]">
                  ⚡
                </span>
              </span>
            </h1>

            <p className="mt-5 max-w-[560px] text-[15px] leading-[1.45] tracking-[-0.02em] text-[#5d6150] sm:mt-6 sm:text-[18px]">
              Real-time 2-player arithmetic duels.
              <br />
              Answer faster, beat your opponent,
              <br />
              and take home <span className="text-[#a6b900]">95%</span> of the
              pot.
            </p>

            <div className="mt-6 grid gap-2.5 sm:mt-7 sm:grid-cols-3">
              {featurePills.map((pill) => {
                const Icon = pill.icon;
                return (
                  <div
                    key={pill.label}
                    className="flex min-h-[58px] items-center gap-3 rounded-2xl border border-[#e2dfcf] bg-[rgba(251,248,235,0.86)] px-3 py-2.5 shadow-[0_10px_26px_rgba(48,50,20,0.05)] backdrop-blur-sm sm:min-h-[66px] sm:px-4 sm:py-3"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef4b3] text-[#9eb300] sm:h-10 sm:w-10">
                      <Icon size={16} className="sm:text-[18px]" />
                    </div>
                    <div className="text-[12px] font-semibold leading-[1.15] tracking-[-0.03em] text-[#161616] sm:text-[13px]">
                      {pill.label}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row sm:items-center">
              {isAuthenticated ? (
                <Link
                  href="/matchmaking"
                  className="inline-flex min-h-[64px] w-full items-center justify-between gap-4 rounded-[22px] border border-[#cfd6a2] bg-[#dce7a8] px-4 text-[16px] font-semibold tracking-[-0.04em] text-[#111111] shadow-[0_16px_36px_rgba(122,134,47,0.14)] transition hover:-translate-y-0.5 sm:w-auto sm:min-h-[74px] sm:px-5 sm:text-[18px]"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d0de78] text-[#385000] sm:h-9 sm:w-9">
                      <RiWallet3Fill size={16} className="sm:text-[18px]" />
                    </span>
                    Start dueling
                  </span>
                  <RiArrowRightLine size={20} className="sm:text-[22px]" />
                </Link>
              ) : (
                <div className="inline-flex w-full items-center sm:w-auto">
                  <WalletButton size="md" />
                </div>
              )}
            </div>

            <p className="mt-3 flex items-center gap-2 text-[11px] font-medium text-[#66705a] sm:text-[12px]">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#bcc49a] text-[#8ea100]">
                ✓
              </span>
              Secure. Non-custodial. Built on Celo.
            </p>
          </div>

          <div className="relative flex justify-center lg:justify-end">
            <div
              aria-hidden
              className="absolute left-4 top-10 hidden h-24 w-24 rounded-full bg-[#d8e000]/12 blur-3xl lg:block"
            />
            <div
              aria-hidden
              className="absolute bottom-0 right-8 hidden h-28 w-28 rounded-full bg-[#ffd84a]/15 blur-3xl lg:block"
            />

            <div className="relative mx-auto w-[min(100%,520px)] rotate-0 rounded-[26px] border border-[#e6e4cd] bg-[rgba(247,246,226,0.84)] p-3 shadow-[0_22px_46px_rgba(77,79,42,0.12)] backdrop-blur-md lg:mx-0 lg:w-full lg:max-w-[560px] lg:-rotate-[-4deg] lg:p-4">
              <div className="absolute -right-6 top-12 hidden h-36 w-36 rounded-full border border-dashed border-[#e5df9b]/70 lg:block" />
              <div className="absolute -left-4 top-36 hidden h-24 w-24 rounded-full border border-dashed border-[#e5df9b]/70 lg:block" />

              <div className="mb-2.5 flex items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#dde0ba] bg-[#f8f6e8] px-3 py-1 text-[11px] font-semibold tracking-[-0.03em] text-[#3e4a18] shadow-[0_8px_18px_rgba(87,92,35,0.06)] sm:px-4 sm:py-1.5 sm:text-[12px]">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#7f9a17] shadow-[0_0_0_3px_rgba(127,154,23,0.12)]" />
                  LIVE DUEL
                </span>
              </div>

              <div className="rounded-[24px] border border-[#e7e2c6] bg-[#f7f7ef] px-4 pb-4 pt-4 shadow-[0_18px_36px_rgba(78,80,41,0.1)] sm:rounded-[28px] sm:px-5 sm:pb-5 sm:pt-5">
                <div className="flex items-center justify-between gap-3 sm:gap-4">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="relative h-11 w-11 overflow-hidden rounded-full border-2 border-[#a6b72f] bg-[#d7e0a2] shadow-[0_10px_20px_rgba(88,95,32,0.12)] sm:h-14 sm:w-14">
                      <Image
                        src="/greenmascot.png"
                        alt="MathsBlitz mascot"
                        fill
                        sizes="56px"
                        className="object-contain object-center scale-[1.12] duel-avatar-float"
                        priority
                      />
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold tracking-[-0.03em] text-[#111111] sm:text-[16px]">
                        You
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] font-medium tracking-[-0.03em] text-[#7a8a10] sm:text-[13px]">
                        <RiFlashlightFill />
                        1250
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="relative flex h-[84px] w-[84px] items-center justify-center rounded-full shadow-[0_12px_24px_rgba(87,92,35,0.08)] sm:h-[108px] sm:w-[108px]">
                      <div
                        aria-hidden
                        className="absolute inset-0 rounded-full"
                        style={{
                          background:
                            "conic-gradient(from -88deg, #7f9b19 0deg 86deg, #d7e0a2 86deg 360deg)",
                        }}
                      />
                      <div
                        aria-hidden
                        className="absolute inset-[7px] rounded-full bg-[#f8f8ef] sm:inset-[9px]"
                      />
                      
                      <div className="relative z-10 text-center leading-none">
                        <div className="text-[30px] font-black tracking-[-0.08em] text-[#111111] sm:text-[40px]">
                          27
                        </div>
                        <div className="mt-0.5 text-[10px] font-semibold tracking-[0.08em] text-[#556033] sm:mt-1 sm:text-[11px]">
                          SEC
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="text-right">
                      <div className="text-[14px] font-semibold tracking-[-0.03em] text-[#111111] sm:text-[16px]">
                        Rival
                      </div>
                      <div className="mt-0.5 flex items-center justify-end gap-1 text-[11px] font-medium tracking-[-0.03em] text-[#7a8a10] sm:text-[13px]">
                        <RiFlashlightFill />
                        1180
                      </div>
                    </div>
                    <div className="relative h-11 w-11 overflow-hidden rounded-full border-2 border-[#dc6f5d] bg-[#f5d0be] shadow-[0_10px_20px_rgba(88,95,32,0.12)] sm:h-14 sm:w-14">
                      <Image
                        src="/redmascot.png"
                        alt="MathsBlitz rival mascot"
                        fill
                        sizes="56px"
                        className="object-contain object-center scale-[1.12] duel-avatar-float duel-avatar-float-delayed"
                        priority
                      />
                    </div>
                  </div>
                </div>

                <div className="relative mt-3.5 rounded-[22px] border border-[#ddd7bf] bg-[#faf9f2] px-4 pb-4 pt-3.5 shadow-[0_16px_28px_rgba(68,70,35,0.08)] sm:mt-4 sm:rounded-[24px] sm:px-5 sm:pb-5 sm:pt-4">
                  
                  <div className="pt-1 text-center text-[clamp(1.3rem,7vw,2.8rem)] font-black tracking-[-0.08em] text-[#111111] sm:text-[clamp(1.6rem,3vw,2.8rem)]">
                    24 × 7 + 15 = ?
                  </div>

                  <div className="mt-3 rounded-[18px] border border-[#ddd9c4] bg-white/70 px-3.5 py-2.5 shadow-inner sm:mt-4 sm:rounded-[20px] sm:px-4 sm:py-3">
                    <div className="text-[14px] italic text-[#b4b4a8] sm:text-[16px]">
                      Type your answer...
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 rounded-[20px] border border-[#e3dec7] bg-[#fbfaef] px-4 py-3.5 sm:mt-4 sm:rounded-[22px] sm:px-5 sm:py-4">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="flex-1">
                      <div className="mb-1 text-[12px] font-semibold tracking-[-0.02em] text-[#111111]">
                        You
                      </div>
                      <div className="h-1.5 rounded-full bg-[#e0e6b7] sm:h-2">
                        <div className="h-full w-[64%] rounded-full bg-[#a6bf40]" />
                      </div>
                    </div>
                    <div className="text-[13px] font-semibold text-[#5e6741] sm:text-[15px]">
                      VS
                    </div>
                    <div className="flex-1">
                      <div className="mb-1 text-right text-[12px] font-semibold tracking-[-0.02em] text-[#111111]">
                        Rival
                      </div>
                      <div className="h-1.5 rounded-full bg-[#eee4ab] sm:h-2">
                        <div className="h-full w-[48%] rounded-full bg-[#f0cf2d]" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 flex items-end justify-between gap-3 rounded-[20px] border border-[#e4dec2] bg-[#fbfbf2] px-4 py-3.5 sm:mt-4 sm:gap-4 sm:rounded-[24px] sm:px-5 sm:py-4">
                  <div>
                    <div className="text-[10px] font-semibold tracking-[0.06em] text-[#4d5d1e] sm:text-[11px]">
                      CURRENT POT
                    </div>
                    <div className="mt-1 text-[clamp(1.5rem,7vw,2.6rem)] font-black tracking-[-0.07em] text-[#5f7419] sm:text-[clamp(1.7rem,2.9vw,2.6rem)]">
                      0.50 CELO
                    </div>
                    <div className="text-[11px] text-[#5b5d52] sm:text-[13px]">
                      Winner receives 0.475 CELO (95%)
                    </div>
                  </div>

                  <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-[#d9deb2] bg-[#f6f5e8] shadow-[0_12px_24px_rgba(71,76,30,0.08)] sm:h-[88px] sm:w-[88px]">
                    <div className="text-center text-[1.8rem] sm:text-[2.1rem]">🪙</div>
                  </div>
                </div>
              </div>

              <div className="absolute -right-5 top-1/2 hidden -translate-y-1/2 rotate-6 text-[clamp(5rem,10vw,9rem)] font-black leading-none text-[#f1cf26]/95 lg:block">
                ⚡
              </div>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
