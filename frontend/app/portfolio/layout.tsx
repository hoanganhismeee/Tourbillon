// Standalone layout for the portfolio hub (/portfolio).
// Loads the "Studio" typeface set (grotesk display, grotesk body, technical mono) as
// scoped CSS variables and sets the hub page title. This is a parent layout over the
// case studies, but they override the title and load their own Atelier fonts.
// Site chrome is suppressed upstream by ChromeGate for /portfolio routes.
import type { Metadata } from "next";
import { Bricolage_Grotesque, Manrope, IBM_Plex_Mono, Fraunces } from "next/font/google";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

// Italic serif used for expressive accents (name, ghost numerals) — ties to the case studies.
const serif = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono-studio",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Hoang Anh Chu — Portfolio",
  description:
    "Hoang Anh Chu (Brandon) — full-stack software engineer with an AI focus. Selected work: Tourbillon and FuelUp.",
};

export default function PortfolioHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${display.variable} ${serif.variable} ${body.variable} ${mono.variable}`}>
      {children}
    </div>
  );
}
