

# Theme Consistency Audit and Fix Plan

## Problem Summary

Multiple pages and components use **hardcoded colors** (`bg-white`, `text-slate-*`, `bg-slate-*`, `text-gray-*`, `bg-[#hex]`, `border-slate-*`) instead of CSS variable-based Tailwind classes (`bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `border-border`). These elements will not respond to dark mode toggling.

## Affected Files (by severity)

### Critical - Entire pages broken in dark mode

1. **`src/pages/Landing.tsx`** (~50+ hardcoded colors)
   - Root: `bg-white text-slate-900` -- should be `bg-background text-foreground`
   - Hero section: `from-[#f0f9ff] to-[#e0f2fe]` -- needs `dark:` variants
   - Buttons: `bg-white`, `text-slate-800`, `border-slate-300`, `hover:bg-slate-50`
   - Stats: `text-slate-500`, `border-slate-200`
   - Cards: `bg-white`, `border-slate-100`, `text-slate-500`
   - CTA section: hardcoded blue hex values (acceptable as brand colors, but surrounding bg/text needs dark variants)
   - Inline footer: `bg-white`, `border-slate-100`, `text-slate-400/500/600` -- all hardcoded
   - Hero image overlay card: `bg-white`, `border-slate-100`

2. **`src/pages/About.tsx`** (~30+ hardcoded colors)
   - Root: `bg-[#fcfdfe] text-slate-900`
   - Cards: `bg-white/80`, `border-slate-200/70`, `text-slate-600`
   - "For Players" card: `border-slate-100 bg-white`
   - CTA button: `text-white` on `border-slate-200` (already broken in light mode too)
   - Heritage section: `bg-slate-900` (intentional dark section, OK)

3. **`src/components/layout/GuestNavbar.tsx`** (~10 hardcoded colors)
   - Root: `border-slate-200/70 bg-white/75` -- should use `border-border/70 bg-background/75`
   - Nav text: `text-slate-600`, `text-slate-700`
   - CTA button: `bg-blue-600` (brand color, acceptable but shadow `shadow-blue-200` breaks in dark)
   - Mobile menu links: `text-slate-700`, `border-slate-200`

### Moderate - Specific elements broken

4. **`src/pages/CourtDetail.tsx`** (~15 hardcoded colors)
   - Glassmorphism section labels: `text-gray-400` -- should be `text-muted-foreground`
   - Gallery nav buttons: `bg-white/90`, `text-gray-800`
   - Image dots: `bg-white` / `bg-white/50` (overlay context -- acceptable)

5. **`src/components/courts/CourtCard.tsx`**
   - Image dots: `bg-white` / `bg-white/50` (overlay on images -- acceptable)

6. **`src/components/layout/Header.tsx`** and **`src/components/layout/MobileLayout.tsx`** and **`src/components/layout/Footer.tsx`**
   - Logo uses `mix-blend-screen` -- this makes the logo invisible on white/light backgrounds; needs conditional class based on theme

## Implementation Plan

### Step 1: Fix Landing Page (`Landing.tsx`)
Replace all hardcoded `bg-white`, `text-slate-*`, `bg-slate-*`, `border-slate-*` with theme-aware equivalents:
- `bg-white` → `bg-background` or `bg-card`
- `text-slate-900` → `text-foreground`
- `text-slate-500/600/700` → `text-muted-foreground`
- `border-slate-100/200` → `border-border`
- `bg-slate-50` → `bg-muted`
- Hero gradient: add `dark:from-[dark-variant] dark:to-[dark-variant]`
- Cards in "How it Works": `bg-card border-border`
- Landing footer section: same pattern as above

### Step 2: Fix About Page (`About.tsx`)
Same pattern as Landing. Replace hardcoded colors with theme tokens.
- Root `bg-[#fcfdfe]` → `bg-background`
- Journey cards: `bg-card` + `border-border`
- "For Players" card: `bg-card border-border`
- CTA button fix: `text-foreground` instead of `text-white` on outline

### Step 3: Fix GuestNavbar (`GuestNavbar.tsx`)
- Header: `border-border/70 bg-background/75`
- Nav links: `text-muted-foreground`
- Sign in button: `text-foreground`
- Mobile menu links: `text-foreground`, `border-border`
- CTA button shadow: `shadow-primary/20` instead of `shadow-blue-200`

### Step 4: Fix CourtDetail (`CourtDetail.tsx`)
- Labels `text-gray-400` → `text-muted-foreground`
- Gallery buttons: `bg-background/90 hover:bg-background` with `text-foreground`

### Step 5: Fix Logo `mix-blend-screen`
In `Header.tsx`, `MobileLayout.tsx`, and `Footer.tsx`:
- Remove `mix-blend-screen` -- it makes the logo invisible on light backgrounds
- Use `dark:brightness-0 dark:invert` or simply remove the blend mode if the logo has a transparent background

### Step 6: Verify remaining authenticated pages
The authenticated pages (Games, Profile, Courts, Groups, etc.) already use theme tokens (`bg-background`, `text-foreground`, `bg-card`, etc.) correctly. Manager layout and admin layout also use proper tokens. No changes needed for these.

## Files to Edit (7 total)
1. `src/pages/Landing.tsx`
2. `src/pages/About.tsx`
3. `src/components/layout/GuestNavbar.tsx`
4. `src/pages/CourtDetail.tsx`
5. `src/components/layout/Header.tsx`
6. `src/components/layout/MobileLayout.tsx`
7. `src/components/layout/Footer.tsx`

