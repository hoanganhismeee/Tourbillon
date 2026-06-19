// Checkpoint-based back navigation for the portfolio case studies.
// The back control is always visible and placed between the masthead and the case-study
// text. The hub drops a checkpoint (sessionStorage, tab-scoped) when it mounts. If the
// visitor reached the case study in-app the button is active and router.back() unwinds the
// real history entry (the hub). If they typed the URL directly (no checkpoint) the button
// is greyed out and disabled — there is no in-app history to return to.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const CHECKPOINT_KEY = "tourbillon-portfolio-checkpoint";

// Rendered on the hub: marks that the portfolio was entered in-app this tab session.
export function PortfolioCheckpoint() {
  useEffect(() => {
    try {
      sessionStorage.setItem(CHECKPOINT_KEY, "1");
    } catch {
      /* private browsing / quota — ignore */
    }
  }, []);
  return null;
}

// Rendered on a case study. Active when a hub checkpoint exists, greyed/disabled otherwise.
export function BackToPortfolio() {
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    try {
      setEnabled(sessionStorage.getItem(CHECKPOINT_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={() => router.back()}
      aria-label="Back to portfolio"
      className={`atl-mono group mt-9 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] transition-colors ${
        enabled
          ? "cursor-pointer text-[var(--atl-soft)] hover:text-[var(--atl-oxblood)]"
          : "cursor-not-allowed text-[var(--atl-faint)] opacity-50"
      }`}
    >
      <span
        aria-hidden
        className={enabled ? "transition-transform duration-300 group-hover:-translate-x-1" : ""}
      >
        &larr;
      </span>
      Back to portfolio
    </button>
  );
}
