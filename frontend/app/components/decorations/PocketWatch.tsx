'use client'

// Grand Complication pocket watch SVG.
// ALL five hands use a local-coordinate translate group: the hand is drawn around
// (0,0), and rotate(angle) pivots at exactly (0,0) = the dial/sub-dial centre.
// No absolute-coordinate rotation, no floating-point drift, no edge artifacts.
import { useEffect, useRef } from 'react'

export type WatchVariant = 'gold' | 'platinum' | 'skeleton' | 'champagne'

interface LuxuryWatchProps {
  size?: number
  className?: string
  variant?: WatchVariant
}

interface WatchTheme {
  caseFill: string
  bezShadow: string; bezShadowW: number
  bezRim: string;    bezRimOpacity: number
  bezInner: string;  bezInnerOpacity: number
  dialFill: string
  subDialFill: string; subStepFill: string
  ringStroke: string; ringOpacity: number
  innerZoneFill: string
  minuteTrack: string; minuteTrackOpacity: number
  mCardinal: string; mCardinalOpacity: number
  mRegular: string;  mRegularOpacity: number
  handFill: string; handOpacity: number; handTailOpacity: number
  centerBg: string; centerDot: string; centerRim: string
  bowColor: string; bowWidth: number; bowOpacity: number
  bowHighlight: string; bowHlOpacity: number
  pendantFill: string
}

const CX = 100
const CY = 133

// Sub-dial centres on the inner ring (r=47)
const SD_R  = 15
const SD_9  = { cx: CX - 47, cy: CY }
const SD_6  = { cx: CX,      cy: CY + 47 }
const SD_3  = { cx: CX + 47, cy: CY }

// Speeds deg/s — hour < minute < sub-dials
const SPD_HOUR   = 3
const SPD_MINUTE = 12
const SPD_9      = 36
const SPD_6      = 54
const SPD_3      = 75

const THEMES: Record<WatchVariant, WatchTheme> = {
  gold: {
    caseFill: '#1c1008',
    bezShadow: '#6a4a20', bezShadowW: 3.5,
    bezRim: '#d4a853',    bezRimOpacity: 0.82,
    bezInner: '#8a6030',  bezInnerOpacity: 0.55,
    dialFill: '#160e06',  subDialFill: '#1e1508', subStepFill: '#120c04',
    ringStroke: '#d4a853', ringOpacity: 0.22,
    innerZoneFill: '#120c04',
    minuteTrack: '#d4a853', minuteTrackOpacity: 0.35,
    mCardinal: '#d4a853', mCardinalOpacity: 0.92,
    mRegular: '#b89050',  mRegularOpacity: 0.62,
    handFill: '#d4a853', handOpacity: 0.96, handTailOpacity: 0.45,
    centerBg: '#1c1008', centerDot: '#f0e6d2', centerRim: '#d4a853',
    bowColor: '#d4a853', bowWidth: 6,   bowOpacity: 0.95,
    bowHighlight: '#f0e6d2', bowHlOpacity: 0.45,
    pendantFill: '#d4a853',
  },
  platinum: {
    caseFill: '#10101a',
    bezShadow: '#404055', bezShadowW: 3.5,
    bezRim: '#d0d0e8',    bezRimOpacity: 0.75,
    bezInner: '#606075',  bezInnerOpacity: 0.5,
    dialFill: '#0c0c16',  subDialFill: '#12121e', subStepFill: '#080812',
    ringStroke: '#c8c8e0', ringOpacity: 0.20,
    innerZoneFill: '#080812',
    minuteTrack: '#c0c0d8', minuteTrackOpacity: 0.30,
    mCardinal: '#dcdce8', mCardinalOpacity: 0.90,
    mRegular: '#9898b8',  mRegularOpacity: 0.58,
    handFill: '#e0e0f0', handOpacity: 0.94, handTailOpacity: 0.42,
    centerBg: '#10101a', centerDot: '#ffffff', centerRim: '#c8c8e0',
    bowColor: '#c0c0d8', bowWidth: 6,   bowOpacity: 0.92,
    bowHighlight: '#e8e8f8', bowHlOpacity: 0.40,
    pendantFill: '#a0a0c0',
  },
  skeleton: {
    caseFill: 'rgba(18,12,6,0.18)',
    bezShadow: '#f0e6d2', bezShadowW: 0.7,
    bezRim: '#f0e6d2',    bezRimOpacity: 0.20,
    bezInner: '#f0e6d2',  bezInnerOpacity: 0.10,
    dialFill: 'transparent', subDialFill: 'rgba(24,16,8,0.35)', subStepFill: 'rgba(0,0,0,0.25)',
    ringStroke: '#f0e6d2', ringOpacity: 0.14,
    innerZoneFill: 'transparent',
    minuteTrack: '#f0e6d2', minuteTrackOpacity: 0.18,
    mCardinal: '#f0e6d2', mCardinalOpacity: 0.55,
    mRegular: '#f0e6d2',  mRegularOpacity: 0.22,
    handFill: '#f0e6d2', handOpacity: 0.78, handTailOpacity: 0.30,
    centerBg: 'rgba(24,16,8,0.55)', centerDot: '#d4a853', centerRim: '#f0e6d2',
    bowColor: '#f0e6d2', bowWidth: 1.8, bowOpacity: 0.40,
    bowHighlight: '#f0e6d2', bowHlOpacity: 0.10,
    pendantFill: 'rgba(240,230,210,0.30)',
  },
  champagne: {
    caseFill: '#1a1008',
    bezShadow: '#805020', bezShadowW: 3.5,
    bezRim: '#f0e6d2',    bezRimOpacity: 0.80,
    bezInner: '#a07040',  bezInnerOpacity: 0.50,
    dialFill: '#140e06',  subDialFill: '#1a1206', subStepFill: '#0e0a04',
    ringStroke: '#f0e6d2', ringOpacity: 0.20,
    innerZoneFill: '#100a04',
    minuteTrack: '#d4c090', minuteTrackOpacity: 0.35,
    mCardinal: '#f0e6d2', mCardinalOpacity: 0.92,
    mRegular: '#c8a870',  mRegularOpacity: 0.60,
    handFill: '#f0e6d2', handOpacity: 0.96, handTailOpacity: 0.45,
    centerBg: '#1a1008', centerDot: '#d4a853', centerRim: '#f0e6d2',
    bowColor: '#d4b878', bowWidth: 6,   bowOpacity: 0.95,
    bowHighlight: '#f0e6d2', bowHlOpacity: 0.45,
    pendantFill: '#c4a050',
  },
}

const MINUTE_MARKS = Array.from({ length: 60 }, (_, i) => ({
  rotation: i * 6,
  isQuarter: i % 15 === 0,
  isFive:    i % 5 === 0 && i % 15 !== 0,
}))

const HOUR_INDICES = Array.from({ length: 12 }, (_, i) => ({
  rotation: i * 30,
  isCardinal: i % 3 === 0,
}))

export default function PocketWatch({ size = 200, className = '', variant = 'champagne' }: LuxuryWatchProps) {
  const t = THEMES[variant]

  const hourRef   = useRef<SVGGElement>(null)
  const minuteRef = useRef<SVGGElement>(null)
  const sub9Ref   = useRef<SVGGElement>(null)
  const sub6Ref   = useRef<SVGGElement>(null)
  const sub3Ref   = useRef<SVGGElement>(null)

  const angles = useRef({ hour: 40, minute: 200, s9: 110, s6: 250, s3: 70 })
  // scrollDir is the source of truth for direction — set on scroll event, cleared on stop
  const scrollDir      = useRef<'up' | 'down' | 'idle'>('idle')
  const scrollSpeed    = useRef(0)   // magnitude only (px/s), always >= 0
  const smoothedSpeed  = useRef(0)   // smoothed magnitude for boost
  const lastScrollY    = useRef(0)
  const lastScrollTime = useRef(0)
  const stopTimer      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef         = useRef<number>(0)

  useEffect(() => {
    lastScrollTime.current = performance.now()
    lastScrollY.current    = window.scrollY

    // All refs use local-coordinate groups → rotate(angle) pivots at (0,0)
    const apply = () => {
      hourRef.current?.setAttribute('transform',   `rotate(${angles.current.hour})`)
      minuteRef.current?.setAttribute('transform', `rotate(${angles.current.minute})`)
      sub9Ref.current?.setAttribute('transform',   `rotate(${angles.current.s9})`)
      sub6Ref.current?.setAttribute('transform',   `rotate(${angles.current.s6})`)
      sub3Ref.current?.setAttribute('transform',   `rotate(${angles.current.s3})`)
    }
    apply()

    const onScroll = () => {
      const ts = performance.now()
      const dt = ts - lastScrollTime.current
      if (dt > 0) {
        const rawVel = ((window.scrollY - lastScrollY.current) / dt) * 1000
        scrollDir.current   = rawVel < 0 ? 'up' : 'down'
        scrollSpeed.current = Math.abs(rawVel)
      }
      lastScrollY.current    = window.scrollY
      lastScrollTime.current = ts

      // No scroll event for 100ms → user stopped; snap to idle immediately
      if (stopTimer.current) clearTimeout(stopTimer.current)
      stopTimer.current = setTimeout(() => {
        scrollDir.current   = 'idle'
        scrollSpeed.current = 0
      }, 100)
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    let lastFrame = performance.now()

    const tick = (ts: number) => {
      const dt = (ts - lastFrame) / 1000
      lastFrame = ts
      smoothedSpeed.current += (scrollSpeed.current - smoothedSpeed.current) * 0.2
      scrollSpeed.current   *= 0.85
      // Direction from explicit state — idle and scroll-down are both forward
      const direction = scrollDir.current === 'up' ? -1 : 1
      const boost     = direction * Math.min(4, 1 + smoothedSpeed.current * 0.004)
      angles.current.hour   += SPD_HOUR   * boost * dt
      angles.current.minute += SPD_MINUTE * boost * dt
      angles.current.s9     += SPD_9      * boost * dt
      angles.current.s6     += SPD_6      * boost * dt
      angles.current.s3     += SPD_3      * boost * dt
      apply()
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('scroll', onScroll)
      if (stopTimer.current) clearTimeout(stopTimer.current)
    }
  }, [])

  return (
    <svg
      width={size}
      height={Math.round(size * 1.2)}
      viewBox="0 0 200 240"
      className={className}
      aria-label="Animated luxury pocket watch"
      role="img"
    >
      {/* ── BOW RING ─────────────────────────────── */}
      <rect x="97.5" y="22" width="5" height="18" rx="2"
        fill={t.pendantFill} fillOpacity={variant === 'skeleton' ? 0.35 : 0.95} />
      <rect x="95.5" y="28" width="9" height="6" rx="2"
        fill={t.pendantFill} fillOpacity={variant === 'skeleton' ? 0.28 : 0.9} />
      <ellipse cx={CX} cy="14" rx="13" ry="11"
        fill="none" stroke={t.bowColor} strokeWidth={t.bowWidth} strokeOpacity={t.bowOpacity} />
      <ellipse cx={CX} cy="14" rx="9" ry="7"
        fill="none" stroke={t.bowHighlight} strokeWidth="0.8" strokeOpacity={t.bowHlOpacity} />

      {/* ── CASE & BEZEL ─────────────────────────── */}
      <circle cx={CX} cy={CY} r="89" fill={t.caseFill} />
      <circle cx={CX} cy={CY} r="88" fill="none" stroke={t.bezShadow} strokeWidth={t.bezShadowW} />
      <circle cx={CX} cy={CY} r="84" fill="none" stroke={t.bezRim}   strokeWidth="1.4" strokeOpacity={t.bezRimOpacity} />
      <circle cx={CX} cy={CY} r="82" fill="none" stroke={t.bezRim}   strokeWidth="0.4" strokeOpacity={t.bezRimOpacity * 0.4} />
      <circle cx={CX} cy={CY} r="81" fill="none" stroke={t.bezInner} strokeWidth="0.7" strokeOpacity={t.bezInnerOpacity} />

      {/* ── DIAL ─────────────────────────────────── */}
      <circle cx={CX} cy={CY} r="80" fill={t.dialFill} />
      <circle cx={CX} cy={CY} r="78" fill="none" stroke={t.ringStroke} strokeWidth="0.8" strokeOpacity={t.ringOpacity * 2.5} />
      <circle cx={CX} cy={CY} r="63" fill="none" stroke={t.ringStroke} strokeWidth="0.6" strokeOpacity={t.ringOpacity * 2.0} />
      <circle cx={CX} cy={CY} r="47" fill="none" stroke={t.ringStroke} strokeWidth="0.9" strokeOpacity={t.ringOpacity * 3.0} />
      <circle cx={CX} cy={CY} r="47" fill={t.innerZoneFill} fillOpacity="0.88" />

      {/* ── MINUTE TRACK ─────────────────────────── */}
      {MINUTE_MARKS.map(({ rotation, isQuarter, isFive }) => {
        const y1 = CY - 78
        const y2 = CY - (isQuarter ? 70 : isFive ? 72 : 74.5)
        const w  = isQuarter ? 1.6 : isFive ? 1.0 : 0.5
        const op = isQuarter ? t.minuteTrackOpacity * 1.8 : isFive ? t.minuteTrackOpacity * 1.3 : t.minuteTrackOpacity
        return (
          <line key={rotation}
            x1={CX} y1={y1} x2={CX} y2={y2}
            stroke={t.minuteTrack} strokeWidth={w}
            strokeLinecap="round" strokeOpacity={Math.min(1, op)}
            transform={`rotate(${rotation}, ${CX}, ${CY})`}
          />
        )
      })}

      {/* ── HOUR INDICES ─────────────────────────── */}
      {HOUR_INDICES.map(({ rotation, isCardinal }) => {
        const w = isCardinal ? 4.2 : 2.4
        const h = isCardinal ? 12  : 7
        return (
          <rect key={rotation}
            x={CX - w / 2} y={CY - 70.5 - h / 2}
            width={w} height={h} rx="0.5"
            fill={isCardinal ? t.mCardinal : t.mRegular}
            fillOpacity={isCardinal ? t.mCardinalOpacity : t.mRegularOpacity}
            transform={`rotate(${rotation}, ${CX}, ${CY})`}
          />
        )
      })}

      {/* ══════════════════════════════════════════════════════════════
          THREE SUB-DIALS — translate(cx,cy) so hand local (0,0) = sub-dial centre
          ══════════════════════════════════════════════════════════════ */}
      {([
        [SD_9, sub9Ref],
        [SD_6, sub6Ref],
        [SD_3, sub3Ref],
      ] as const).map(([sd, ref], idx) => (
        <g key={idx} transform={`translate(${sd.cx}, ${sd.cy})`}>
          <circle r={SD_R}     fill={t.subDialFill} />
          <circle r={SD_R}     fill="none" stroke={t.ringStroke} strokeWidth="0.7" strokeOpacity={t.ringOpacity * 2.4} />
          <circle r={SD_R - 4} fill={t.subStepFill} />
          <circle r={SD_R - 4} fill="none" stroke={t.ringStroke} strokeWidth="0.4" strokeOpacity={t.ringOpacity * 1.5} />
          {/* 12 tick marks in local coords */}
          {Array.from({ length: 12 }, (_, i) => {
            const isCard = i % 3 === 0
            const rad    = (i * 30 - 90) * Math.PI / 180
            const r1     = SD_R - 1
            const r2     = SD_R - (isCard ? 5.5 : 3.5)
            const rnd    = (n: number) => Math.round(n * 1000) / 1000
            return (
              <line key={i}
                x1={rnd(r1 * Math.cos(rad))} y1={rnd(r1 * Math.sin(rad))}
                x2={rnd(r2 * Math.cos(rad))} y2={rnd(r2 * Math.sin(rad))}
                stroke={isCard ? t.mCardinal : t.mRegular}
                strokeWidth={isCard ? 1.0 : 0.5}
                strokeOpacity={isCard ? t.mCardinalOpacity * 0.82 : t.mRegularOpacity * 0.65}
              />
            )
          })}
          {/* Baton hand — local coords, rotates around (0,0) */}
          <g ref={ref} style={{ willChange: 'transform' }}>
            <line x1="0" y1={-(SD_R - 3)} x2="0" y2="0"
              stroke={t.handFill} strokeWidth="1.8"
              strokeLinecap="round" strokeOpacity={t.handOpacity * 0.88}
            />
            <line x1="0" y1="1" x2="0" y2="5"
              stroke={t.handFill} strokeWidth="1.8"
              strokeLinecap="round" strokeOpacity={t.handTailOpacity}
            />
          </g>
          <circle r="2.4" fill={t.centerBg} />
          <circle r="1.5" fill={t.centerRim} fillOpacity="0.72" />
          <circle r="0.75" fill={t.centerDot} />
        </g>
      ))}

      {/* ══════════════════════════════════════════════════════════════
          MAIN HANDS — translate(CX,CY) so hand local (0,0) = case centre
          All coordinates are relative to pivot. No absolute SVG positions.
          ══════════════════════════════════════════════════════════════ */}

      {/* HOUR HAND — broad dauphine, local coords */}
      <g transform={`translate(${CX}, ${CY})`}>
        <g ref={hourRef} style={{ willChange: 'transform' }}>
          {/* Main body: tip at (0,-52), shoulder ±5 at y=-22, root at (0,0) */}
          <polygon
            points="0,-52  5,-22  1.8,0  -1.8,0  -5,-22"
            fill={t.handFill} fillOpacity={t.handOpacity}
          />
          {/* Centre ridge highlight */}
          <line x1="0" y1="-52" x2="0" y2="0"
            stroke="#ffffff" strokeWidth="0.6"
            strokeLinecap="round" strokeOpacity="0.30"
          />
          {/* Pear counterweight */}
          <polygon
            points="-1.8,0  1.8,0  2.6,9  0,13  -2.6,9"
            fill={t.handFill} fillOpacity={t.handTailOpacity}
          />
        </g>
      </g>

      {/* MINUTE HAND — slender dauphine, local coords */}
      <g transform={`translate(${CX}, ${CY})`}>
        <g ref={minuteRef} style={{ willChange: 'transform' }}>
          {/* Main body: tip at (0,-68), shoulder ±3.5 at y=-34, root at (0,0) */}
          <polygon
            points="0,-68  3.5,-34  1.4,0  -1.4,0  -3.5,-34"
            fill={t.handFill} fillOpacity={t.handOpacity * 0.94}
          />
          {/* Centre ridge highlight */}
          <line x1="0" y1="-68" x2="0" y2="0"
            stroke="#ffffff" strokeWidth="0.45"
            strokeLinecap="round" strokeOpacity="0.26"
          />
          {/* Pear counterweight */}
          <polygon
            points="-1.4,0  1.4,0  2.2,8  0,12  -2.2,8"
            fill={t.handFill} fillOpacity={t.handTailOpacity}
          />
        </g>
      </g>

      {/* ── CENTRE CAP ──────────────────────────── */}
      <circle cx={CX} cy={CY} r="6.5" fill={t.centerBg} />
      <circle cx={CX} cy={CY} r="4.5" fill={t.centerRim} fillOpacity="0.65" />
      <circle cx={CX} cy={CY} r="2.2" fill={t.centerDot} />
    </svg>
  )
}
