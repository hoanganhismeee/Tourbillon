// Reusable two-column layout: scrollable content on the left, sticky decoration on the right.
// Use this anywhere you want a LuxuryWatch (or any element) pinned to the viewport while
// the user reads through long content. The decoration receives scroll events normally since
// it is in the DOM flow — only its visual position is sticky via CSS.
import { ReactNode } from 'react'

interface WatchStickyLayoutProps {
  // Right column: any decoration — typically <LuxuryWatch /> with an optional caption
  decoration: ReactNode
  // Left column: the scrollable page content
  children: ReactNode
}

export default function WatchStickyLayout({ decoration, children }: WatchStickyLayoutProps) {
  return (
    <div className="flex gap-16 items-start">

      {/* Left: scrollable content */}
      <div className="flex-1 min-w-0">
        {children}
      </div>

      {/* Right: sticky decoration — hidden on mobile, visible on lg+ */}
      <div className="hidden lg:flex flex-col items-center gap-4 flex-shrink-0 w-64 sticky top-24">
        {decoration}
      </div>

    </div>
  )
}
