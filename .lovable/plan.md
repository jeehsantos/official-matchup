

## Fix: Staff Users See Empty Pages + Stripe Warnings

### Problem
Two issues with the current staff implementation:

1. **Empty pages**: All manager pages (Availability, Equipment, Bookings, Settings) fetch venues using `.eq("owner_id", user.id)`. Staff users are not venue owners, so they see empty states with no data.

2. **Stripe warning**: The `useManagerStripeReady` hook queries venues by `owner_id`, returning nothing for staff, which triggers the "Stripe Account Setup Required" alert on pages like Availability.

### Root Cause
Staff users access venues through the `venue_staff` table, not via `venues.owner_id`. Every page that fetches venues needs a dual-path: owner query for managers, staff-venue query for staff.

### Solution

**1. Create a shared hook `useManagerVenues`** (`src/hooks/useManagerVenues.ts`)
- If `userRole === "court_manager"`: fetch venues via `.eq("owner_id", user.id)`
- If `userRole === "venue_staff"`: fetch `venue_staff` rows for the user, then fetch venues by those IDs
- Returns the same venue list shape regardless of role
- All manager pages will use this hook instead of inline venue fetches

**2. Update pages to use the shared hook:**
- `ManagerAvailability.tsx` — replace inline `fetchVenues` + `fetchCourts` with `useManagerVenues`
- `ManagerEquipment.tsx` — replace inline `fetchVenues` with `useManagerVenues`
- `ManagerBookings.tsx` — replace inline venue fetch with `useManagerVenues`
- `ManagerSettings.tsx` — replace inline `fetchVenues` with `useManagerVenues`

**3. Hide Stripe warnings for staff:**
- `ManagerAvailability.tsx` — skip rendering `StripeSetupAlert` when `userRole === "venue_staff"`
- `useManagerStripeReady` — return `{ isReady: true }` immediately for `venue_staff` role (staff don't manage Stripe)
- Any other page showing Stripe alerts: conditionally hide for staff

**4. RLS already handled**: The existing RLS policies use `get_staff_venue_ids()` and `is_venue_staff()` so data access at the DB level is already correct. The fix is purely in the frontend query logic.

### Files to create/modify
- `src/hooks/useManagerVenues.ts` (new) — shared venue fetching hook
- `src/pages/manager/ManagerAvailability.tsx` — use shared hook, hide Stripe alert for staff
- `src/pages/manager/ManagerEquipment.tsx` — use shared hook
- `src/pages/manager/ManagerBookings.tsx` — use shared hook
- `src/pages/manager/ManagerSettings.tsx` — use shared hook
- `src/hooks/useStripeConnectStatus.ts` — short-circuit for `venue_staff`

