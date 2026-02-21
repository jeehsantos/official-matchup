
## Problem

The current approach fetches the main court from the URL, renders it, then detects a sport mismatch and tries to auto-switch. Despite multiple attempts to hide this switch (internal re-fetch, refs, loading gates), the user still sees a brief flash of the wrong court because `court` state (used for the page header, photos, badges) is set to the main court before the correction runs.

## Solution: Resolve the correct court inside `fetchCourt()` before any render

Instead of fetching the URL court, rendering it, then correcting -- we resolve the right court **during the initial data fetch**, before any state is committed. The user never sees the wrong court because the component's first meaningful render already has the correct court loaded.

### How it works

1. `fetchCourt()` fetches the court from the URL param as it does now
2. If that court is a multi-court parent (or belongs to a multi-court group), it also fetches all sibling/child courts in the same query
3. It checks if the URL court's `allowed_sports` matches the user's `preferredSports`
4. If not, it finds the first sibling court that does match
5. It sets `court` and `selectedCourtId` to the **correct** court -- the user's first render shows the right data
6. The `fetchAvailability` correction logic and fallback `useEffect` are removed entirely -- they're no longer needed

### Files to modify

**`src/pages/CourtDetail.tsx`** only.

#### Change 1: Refactor `fetchCourt()` to resolve the preferred court

The current `fetchCourt` (lines 215-235) fetches a single court. We extend it to:

```text
1. Fetch the court from the URL (as before)
2. If the court is a multi-court parent or has a parent_court_id:
   - Query all sibling courts (same venue, active)
3. If user has preferredSports and the URL court doesn't match:
   - Find the first sibling that matches
   - Use that court as `court` state + `selectedCourtId`
4. Otherwise, use the URL court as-is
```

This adds one conditional query (only for multi-court venues where the main court doesn't match), which is a simple indexed lookup on `venue_id + is_active`.

#### Change 2: Remove the auto-switch logic from `fetchAvailability` (lines 258-296)

The `isInitialLoad` parameter and the entire preferred-sport correction block inside `fetchAvailability` are removed. `fetchAvailability` goes back to being a simple fetch-and-set function.

#### Change 3: Remove the `isAutoSwitchingRef` and related gating

- Remove `isAutoSwitchingRef` (line 238)
- Remove the `isAutoSwitchingRef.current` check in the availability `useEffect` (line 354)
- Simplify the `useEffect` back to a clean dependency-based fetch

#### Change 4: Remove the fallback preferredSports `useEffect` (lines 361-398)

This entire `useEffect` was only needed because the correction could miss if `preferredSports` loaded late. With the fix in `fetchCourt`, this is unnecessary because `fetchCourt` already has access to `preferredSports` via the closure, and the availability `useEffect` is gated on `!profileLoading`.

#### Change 5: Keep `hasAutoSelectedRef` but use it only in `fetchCourt`

Set `hasAutoSelectedRef.current = true` inside `fetchCourt` after the resolution, so that if the component re-mounts or the URL changes, the logic can run again cleanly.

### Performance characteristics

| Scenario | Network calls | Visible flicker |
|---|---|---|
| Single court venue | 1 (fetchCourt) + 1 (fetchAvailability) = same as before | None |
| Multi-court, main court matches sport | 1 (fetchCourt) + 1 (fetchAvailability) = same as before | None |
| Multi-court, main court doesn't match | 1 (fetchCourt) + 1 (sibling query) + 1 (fetchAvailability) | None -- spinner stays until correct court is resolved |
| No preferred sports set | 1 + 1 = same as before | None |

The sibling query is a simple `SELECT` on `courts` table filtered by `venue_id` and `is_active` -- negligible latency.

### Technical details

```typescript
const fetchCourt = useCallback(async () => {
  try {
    const { data, error } = await supabase
      .from("courts")
      .select("*, venues (*)")
      .eq("id", id)
      .single();

    if (error) throw error;

    let resolvedCourt = data as CourtWithVenue;
    let resolvedCourtId = data.id;

    // For multi-court venues, check if we should show a different court
    if (preferredSports.length > 0 && !profileLoading) {
      const isMultiCourt = data.is_multi_court || data.parent_court_id;

      if (isMultiCourt) {
        const courtSports = data.allowed_sports || [];
        const matchesPreferred =
          courtSports.length === 0 ||
          courtSports.some((s: string) => preferredSports.includes(s));

        if (!matchesPreferred) {
          // Fetch sibling courts
          const venueId = data.venue_id;
          const { data: siblings } = await supabase
            .from("courts")
            .select("*, venues (*)")
            .eq("venue_id", venueId)
            .eq("is_active", true)
            .order("name");

          if (siblings && siblings.length > 1) {
            const betterCourt = siblings.find((c: any) => {
              const sports = c.allowed_sports || [];
              return sports.length === 0 || 
                sports.some((s: string) => preferredSports.includes(s));
            });

            if (betterCourt) {
              resolvedCourt = betterCourt as CourtWithVenue;
              resolvedCourtId = betterCourt.id;
            }
          }
        }
      }
    }

    hasAutoSelectedRef.current = true;
    setCourt(resolvedCourt);
    setSelectedCourtId(resolvedCourtId);
  } catch (error) {
    console.error("Error fetching court:", error);
    navigate("/courts");
  } finally {
    setLoading(false);
  }
}, [id, navigate, preferredSports, profileLoading]);
```

The key insight: by resolving inside `fetchCourt`, the **very first `setCourt` and `setSelectedCourtId` calls** already point to the correct court. The component never renders with wrong data.

### Edge cases

| Scenario | Behaviour |
|---|---|
| Main court matches preferred sport | No sibling query, renders main court |
| No preferred sports configured | No sibling query, renders main court |
| Single court venue | `is_multi_court` is false and `parent_court_id` is null, no sibling query |
| No sibling matches preferred sport | Falls back to main court from URL |
| User manually switches court later | Works as before via dropdown |
| Profile still loading | `fetchCourt` depends on `profileLoading`; waits for profile before resolving |
