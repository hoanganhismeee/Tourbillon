// Shared animation constants — single source of truth for all motion in the project.
// Phase 10 standard: expo-out entrances, fast exits, no linear or playful springs.

// Framer Motion easing arrays (pass directly to the `ease` prop)
export const EASE_LUXURY = [0.16, 1, 0.3, 1] as const   // expo-out — aggressive fast start, elegant settle
export const EASE_ENTER  = [0.22, 1, 0.36, 1] as const  // smooth enter — standard for scroll/UI animations
export const EASE_EXIT   = [0.4, 0, 1, 1] as const      // ease-in — crisp, fast departures

// CSS string variants — for inline `style.transition` properties in non-Framer components
export const EASE_LUXURY_CSS = 'cubic-bezier(0.16, 1, 0.3, 1)'
export const EASE_ENTER_CSS  = 'cubic-bezier(0.22, 1, 0.36, 1)'
export const EASE_EXIT_CSS   = 'cubic-bezier(0.4, 0, 1, 1)'

// Durations in seconds (for Framer Motion transition props)
export const DUR = {
  fast:  0.25,   // micro-interactions (hover, tap feedback)
  mid:   0.6,    // card entrances, panel slides
  slow:  1.0,    // page heroes, text reveals
  crawl: 1.6,    // GSAP scroll pin sequences
} as const

// Panel exit in milliseconds — used for form state reset timeouts in panels that
// need to defer cleanup until after the exit animation completes (AppointmentPanel etc.)
export const PANEL_EXIT_MS = 420
