// Decides whether the global Tourbillon site chrome wraps a page.
// Standalone routes (the portfolio case study) opt out of the nav, footer,
// concierge, and custom cursor, and neutralize the global brown body styles.
// usePathname() resolves during SSR, so the branch is chosen server-side (no flash).
"use client";

import { usePathname } from "next/navigation";
import AnimatedLayout from "@/app/scrollMotion/AnimatedLayout";

// Routes that render bare — no site chrome, no inherited body background/margin.
const BARE_PREFIXES = ["/portfolio/tourbillon"];

// Scoped overrides that undo the global brown gradient, top margin, and fixed
// grain/vignette overlays from globals.css for the bare routes. Server-rendered
// in the initial HTML, so the ivory canvas paints with no flash of brown.
const BARE_STYLE = `html{background:#efe7d8 !important}body{margin-top:0 !important}body::before,body::after{display:none !important}`;

export default function ChromeGate({
  header,
  trailing,
  children,
}: {
  header: React.ReactNode;
  trailing: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const bare =
    !!pathname &&
    BARE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (bare) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: BARE_STYLE }} />
        {children}
      </>
    );
  }

  return (
    <>
      {header}
      <AnimatedLayout>{children}</AnimatedLayout>
      {trailing}
    </>
  );
}
