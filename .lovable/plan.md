
## Root Cause

When navigating to `/courts/:id`, the flow is:

1. `fetchCourt()` runs → sets `selectedCourtId` to the URL param's court ID (the main court)
2. Availability loads → `availabilityData.venue_courts` returns all courts for the venue
3. `venueCourts` is filtered by `preferredSports` (lines 1173–1189), but `selectedCourtId` is already pointing at the main court
4. The existing fallback effect (line 1192) only resets `selectedCourtId` if the selected court is **entirely missing** from `allVenueCourts` — the main court IS in that list, so no correction happens
5. Result: the UI renders with the main court selected (wrong sport), then the user must manually switch

## Solution

Introduce a **one-time "initial court selection" effect** that runs immediately after `availabilityData.venue_courts` first arrives. It will:

1. Check if the currently-selected court matches any of the user's `preferredSports`
2. If not, find the first court in `venue_courts` that does match
3. If a better match is found, silently switch `selectedCourtId` before the component renders with data — preventing any visible flicker

A `hasAutoSelectedRef` ref guards this so it only runs on the first availability load (not on date changes, slot changes, or manual court switches).

### Why this is fast

- No extra network request — it uses data already returned by `get-availability` (`venue_courts` array already includes `allowed_sports` per court)
- The switch happens synchronously within the same render cycle after the availability state update, so the user never sees the wrong court

### Files to modify

**`src/pages/CourtDetail.tsx`** only — no backend changes needed.

#### Change 1: Add a `hasAutoSelectedRef` guard (near other refs, ~line 209)

```typescript
// Prevents auto-selecting a preferred court more than once per page load
const hasAutoSelectedRef = useRef(false);
```

#### Change 2: Replace the existing "fallback" useEffect (lines 1192–1201) with an enhanced version that also performs the initial preferred-sport selection

Replace:
```typescript
// Only fall back if the currently selected court no longer exists in venue availability
useEffect(() => {
  if (!selectedCourtId || allVenueCourts.length === 0) return;

  const selectedCourtExists = allVenueCourts.some(c => c.id === selectedCourtId);
  if (!selectedCourtExists) {
    setSelectedCourtId(allVenueCourts[0].id);
    setSelectedSlots([]);
    setCurrentImageIndex(0);
  }
}, [allVenueCourts, selectedCourtId]);
```

With:
```typescript
useEffect(() => {
  if (!selectedCourtId || allVenueCourts.length === 0) return;

  // 1. Fallback: if selected court no longer exists, reset to first available
  const selectedCourtExists = allVenueCourts.some(c => c.id === selectedCourtId);
  if (!selectedCourtExists) {
    setSelectedCourtId(allVenueCourts[0].id);
    setSelectedSlots([]);
    setCurrentImageIndex(0);
    return;
  }

  // 2. One-time auto-selection: switch to a preferred-sport court on first load
  if (hasAutoSelectedRef.current || preferredSports.length === 0 || allVenueCourts.length <= 1) return;

  const currentCourt = allVenueCourts.find(c => c.id === selectedCourtId);
  const currentCourtSports = currentCourt?.allowed_sports || [];
  const currentMatchesPreferred =
    currentCourtSports.length === 0 ||
    currentCourtSports.some(s => preferredSports.includes(s));

  if (!currentMatchesPreferred) {
    // Find the first court in the list that matches preferred sports
    const betterCourt = allVenueCourts.find(c => {
      const sports = c.allowed_sports || [];
      return sports.length === 0 || sports.some(s => preferredSports.includes(s));
    });

    if (betterCourt && betterCourt.id !== selectedCourtId) {
      setSelectedCourtId(betterCourt.id);
      setCurrentImageIndex(0);
      // No need to clear slots — none are selected yet at this point in the flow
    }
  }

  hasAutoSelectedRef.current = true;
}, [allVenueCourts, selectedCourtId, preferredSports]);
```

### Why `hasAutoSelectedRef` prevents regressions

- After the first load, `hasAutoSelectedRef.current = true`, so subsequent `allVenueCourts` updates (e.g. on date change) do NOT trigger another auto-switch
- Manual court selection by the user is unaffected because the ref is already `true`
- No performance impact: no additional fetches, no debouncing needed

### Edge cases handled

| Scenario | Behaviour |
|---|---|
| Main court matches preferred sport | No switch, ref set to `true` |
| No preferred sports configured | No switch (guard at top) |
| Only one court in venue | No switch (guard at top) |
| No court in venue matches preferred sport | No switch (falls back to main court) |
| User manually selects a different court | Unaffected (ref already `true`) |
| Date change triggers new availability fetch | Unaffected (ref already `true`) |
