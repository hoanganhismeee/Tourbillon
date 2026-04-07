# Tourbillon Style Guide

This document defines the UI aesthetics, typography, and styling consistency for the Tourbillon project. All new components must adhere to these patterns.

## Color Palette

- Primary Cream: `#f0e6d2`
- Signature Gold: `#bfa68a`
- Muted White: `text-white/35`, `text-white/50`, `text-white/60`

## Typography

Allowed font families:
- Serif (Headings & Quotes): `font-playfair`
- Sans-Serif (Body & Labels): Default sans

### Main Headings
- Classes: `font-playfair font-light text-[#f0e6d2]`
- Variants: `leading-none`, `leading-[1.0]`, size up to `text-[3.5rem]` or `clamp(3.5rem, 8vw, 7rem)`. `font-bold` can be used for section grids.

### Section Labels
- Classes: `text-[9px]` or `text-[10px]`
- Casing: `uppercase`
- Tracking: `tracking-[0.4em]` to `tracking-[0.5em]`
- Color: `text-[#bfa68a]` or `text-[#bfa68a]/80`

### Body Text
- Classes: `text-sm`, `text-[12px]`, or `text-[13.5px]`
- Line Height: `leading-relaxed` or `leading-[1.85]`
- Color: `text-white/35` to `text-white/60`
- Utilities: `text-balance`

### Blockquotes
- Container: `border-l-2 border-[#bfa68a]/60 pl-5 py-1 mb-8`
- Text: `text-[#f0e6d2] font-playfair italic leading-relaxed`
- Size: `text-[1.1rem]` up to `text-[1.4rem]`
- Citations: `text-[9px] uppercase tracking-[0.28em] text-[#bfa68a]/70 not-italic mt-3`

### Statistics & Numbers
- Number: `font-playfair font-light text-[#f0e6d2] leading-none`
- Subtitle: `text-[8.5px] uppercase tracking-[0.32em] text-[#bfa68a]/70`

## Buttons

### Outlined Buttons
- Container: `border border-[#bfa68a]/25 px-10 py-4`
- Text: `text-[10px] uppercase tracking-[0.3em] text-[#bfa68a]`
- Hover: `hover:bg-[#bfa68a]/8 hover:border-[#bfa68a]/40 transition-all duration-500`

### Gradient Buttons
- Background: `bg-gradient-to-r from-[#bfa68a] via-[#d4b898] to-[#bfa68a]`
- Text: `text-[9.5px] uppercase tracking-[0.32em] font-medium text-[#1e1206]`

## Layout Defaults
- Structural Padding: `py-20`, `px-10`, `lg:px-24`.
- Dividers: `border-b border-white/5` or `h-px bg-[#bfa68a]/15`.
- Framer Motion: `y: 8`, `duration: 0.7`.
