// Decides whether the global Tourbillon site chrome wraps a page.
// Standalone routes (the portfolio case study) opt out of the nav, footer,
// concierge, and custom cursor, and neutralize the global brown body styles.
// usePathname() resolves during SSR, so the branch is chosen server-side (no flash).
"use client";

import { usePathname } from "next/navigation";
import AnimatedLayout from "@/app/scrollMotion/AnimatedLayout";

// Routes that render bare — no site chrome, no inherited body background/margin.
// Each carries the html background its design paints, so overscroll never shows the
// global brown. The "/" entry matches the root exactly (its `prefix + "/"` is "//",
// which never matches a real path), so only the portfolio landing goes bare — not the shop.
const BARE_ROUTES = [
  { prefix: "/projects/tourbillon", bg: "#efe7d8" }, // Atelier ivory (case study)
  { prefix: "/projects/fuelup", bg: "#efe7d8" }, // Atelier ivory (case study)
  { prefix: "/projects/storefrontiq", bg: "#efe7d8" }, // Atelier ivory (case study)
  { prefix: "/", bg: "#1e1512" }, // warm brown (portfolio landing at root)
];

// Scoped overrides that undo the global brown gradient, top margin, and fixed
// grain/vignette overlays from globals.css for the bare routes. Server-rendered
// in the initial HTML, so the page's own canvas paints with no flash of brown.
const bareStyle = (bg: string) =>
  `html{background:${bg} !important}body{margin-top:0 !important}body::before,body::after{display:none !important}`;

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
  const match = pathname
    ? BARE_ROUTES.find(
        (r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"),
      )
    : undefined;

  if (match) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: bareStyle(match.bg) }} />
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
