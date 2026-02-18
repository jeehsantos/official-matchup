

## Preferred Sports Filter Enhancement

### Problem Summary
1. Users can browse courts/games without completing their profile, leading to irrelevant results
2. The sport filter shows a "My Preferred Sports" aggregate option instead of showing only the user's selected sports
3. Caching issues cause stale preferred sports after profile updates
4. No profile completion gate before browsing

---

### Plan

#### 1. Profile Completion Gate (ProtectedRoute Enhancement)

Update `src/components/auth/ProtectedRoute.tsx` to accept an optional `requireCompleteProfile` prop. When enabled, it checks `useUserProfile()` for completeness and renders a friendly full-screen prompt (not a redirect) explaining that completing their profile gives them a better, personalized experience. The prompt includes a button to go to `/profile/edit`.

Apply this gate to the following routes in `src/App.tsx`:
- `/courts`
- `/courts/:id`
- `/discover`
- `/games`
- `/quick-games/:id`

#### 2. Fix Sport Filter Options (Courts + Discover + MobileCourtFilters)

Replace the current filter logic that includes `{ value: "preferred", label: "My Preferred Sports" }` with a simpler approach:

- If the user has preferred sports configured, the filter options show:
  - "All Sports" (shows only the user's preferred sports, not every sport)
  - Individual sport entries for each preferred sport (if more than one)
- If only one preferred sport is configured, default to that single sport (no "All Sports" needed since there's only one)
- Remove the "preferred" virtual filter value entirely

This applies to:
- `src/pages/Courts.tsx` (sportFilterOptions memo)
- `src/pages/Discover.tsx` (sports memo)
- `src/components/courts/MobileCourtFilters.tsx` (receives options as props, no change needed)

The filtering logic for courts/games also changes: "all" now means "all of my preferred sports" (not every sport in the database).

#### 3. Fix Caching Issue on Profile Update

Update `src/pages/ProfileEdit.tsx` to invalidate the `["user-profile"]` query cache after a successful save using `queryClient.invalidateQueries({ queryKey: ["user-profile"] })`. This ensures the preferred sports filter immediately reflects updates.

#### 4. Reduce staleTime for Profile Query

In `src/hooks/useUserProfile.ts`, reduce `staleTime` from 5 minutes to 30 seconds. This ensures profile changes propagate faster across the app without requiring manual invalidation for edge cases.

---

### Technical Details

**Files to modify:**

| File | Change |
|------|--------|
| `src/components/auth/ProtectedRoute.tsx` | Add `requireCompleteProfile` prop, render profile completion prompt |
| `src/App.tsx` | Wrap player-facing routes with `ProtectedRoute requireCompleteProfile` |
| `src/pages/Courts.tsx` | Rewrite `sportFilterOptions` to only show user's preferred sports; change "all" to filter by preferred sports; remove "preferred" value |
| `src/pages/Discover.tsx` | Same filter rewrite as Courts |
| `src/pages/ProfileEdit.tsx` | Invalidate `user-profile` query after save |
| `src/hooks/useUserProfile.ts` | Reduce staleTime to 30s |

**No database changes required.** All logic is frontend filter behavior using existing profile data.

