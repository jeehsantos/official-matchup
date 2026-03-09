

## Logo Replacement Plan

The user uploaded a new colorful SportArena logo to replace the current monochrome logo used across the site.

### Discovery Summary

Found **7 files** using the logo in **8 locations**:

| File | Location | Current Size | New Size |
|------|----------|--------------|----------|
| `GuestNavbar.tsx` | Guest header | h-36 | h-14 (navbar-appropriate) |
| `Footer.tsx` | Site footer | h-24 | h-12 |
| `Landing.tsx` | Landing footer | h-36 | h-14 |
| `Auth.tsx` | Auth card | h-16 | h-14 |
| `Header.tsx` | Mobile header | h-10 | h-8 |
| `MobileLayout.tsx` | Mobile header | h-10 | h-8 |
| `ManagerLayout.tsx` | Desktop sidebar | h-14, h-20 | h-10, h-14 |

### Implementation Steps

1. **Copy new logo** to `public/sportarena-logo.png` (replacing existing)

2. **Update all logo usages**:
   - Remove `dark:brightness-0 dark:invert` classes (new logo is colorful, works on both themes)
   - Adjust heights for proper proportions (new logo is wider/shorter ratio)
   - Keep `object-contain` and `w-auto` for responsive scaling

3. **Responsive sizing strategy**:
   - **Navbars/Headers**: Smaller heights (h-8 to h-14) for proper header alignment
   - **Footers**: Medium heights (h-12 to h-14)
   - **Auth/Feature areas**: Comfortable h-14 for visibility

### Files to Modify

- `public/sportarena-logo.png` — Replace with new logo
- `src/components/layout/GuestNavbar.tsx`
- `src/components/layout/Footer.tsx`
- `src/components/layout/Header.tsx`
- `src/components/layout/MobileLayout.tsx`
- `src/components/layout/ManagerLayout.tsx`
- `src/pages/Landing.tsx`
- `src/pages/Auth.tsx`

