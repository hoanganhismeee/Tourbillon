// Standalone layout for the FuelUp portfolio case study.
// Loads the same "Atelier" typeface set as the Tourbillon case study (display serif,
// grotesk body, technical mono) as scoped CSS variables and sets an HR-facing title.
// The site chrome is suppressed upstream by ChromeGate for this route.
import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-atelier",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hoang Anh Chu — FuelUp",
  description:
    "Portfolio case study: FuelUp, an AI-assisted fitness and nutrition companion app built by Hoang Anh Chu (Brandon).",
};

export default function FuelUpPortfolioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${fraunces.variable} ${hanken.variable} ${jetbrainsMono.variable}`}>
      {children}
    </div>
  );
}
