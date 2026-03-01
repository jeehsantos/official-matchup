

## Problem

The `.custom-price-marker` CSS class uses `width: auto !important` and `height: auto !important`, which overrides the inline `width` and `height` styles that Leaflet sets on the icon container based on `iconSize: [estimatedWidth, 28]`. Since Leaflet relies on these dimensions for click/hit detection, the markers become effectively unclickable and popups never open.

## Fix

**File: `src/index.css`** (lines 319-325)

Remove the `!important` overrides on `width` and `height` from `.custom-price-marker`. Keep `overflow: visible` so the price label can render outside the container if needed, but let Leaflet control the container's dimensions for proper click detection.

```css
.custom-price-marker {
  background: transparent;
  border: none;
  overflow: visible !important;
}
```

Remove `width: auto !important;` and `height: auto !important;` — these two lines are the root cause.

## Why This Works

- Leaflet sets inline `width` and `height` on the icon `<div>` based on `iconSize: [estimatedWidth, 28]`
- These dimensions define the clickable hit area for the marker
- With `!important` overriding them to `auto`, the hit area collapses and clicks pass through
- Removing the overrides restores proper click detection while the child `.price-marker` div still handles visual rendering via `width: max-content`

## Scope

Single CSS change — no JavaScript modifications needed. The `createPriceIcon` function and popup binding logic in `CourtsMap.tsx` are already correct.

