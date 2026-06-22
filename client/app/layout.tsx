import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "MathsBlitz",
  description: "Competitive maths duels on Celo — powered by MiniPay",
  openGraph: {
    title: "MathsBlitz",
    description: "Competitive maths duels on Celo — powered by MiniPay",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta name="talentapp:project_verification" content="d9ed064beb03ecab65fa06938976bd3b94f33e8e8c7f4b2fc0b8c10f8234f4becaa097aa22bfd141250fad3a79ac274d957c34fb6100680c51db686bf334c6f9" />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
