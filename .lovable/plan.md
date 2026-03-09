
Goal: fix Multi-Court so adding a sub-court never corrupts main-court state, and ensure court `57e11168-3d26-42dc-b86a-d5356cdddce4` is corrected.

What I found (already verified):
1) Data inconsistency exists now:
   - Parent: `57e11168-3d26-42dc-b86a-d5356cdddce4` has `is_multi_court=false`
   - Child exists: `6b1acfdb-4245-45c4-acc0-744697546a90` with `parent_court_id=57e11168-3d26-42dc-b86a-d5356cdddce4`
2) `ManagerCourtFormNew` root causes:
   - It uses `window.history.replaceState(...)` (bypasses router state sync), so route param and selected tab can diverge.
   - Sub-court creation path inserts child but does not persist parent `is_multi_court=true`.
   - Multi-court panel visibility depends on `is_multi_court`, so valid child relations can disappear from UI if parent flag is false.
3) Backend side effect confirmed:
   - `get-availability` currently relies on `requestedCourt.is_multi_court` to include children, so this bad state hides sub-courts from booking dropdowns.

Implementation plan (execute in this order):
1. Database integrity hardening + backfill (migration)
   - Backfill: set `is_multi_court=true` for any court that already has children.
   - Add DB validation trigger(s) on `courts` to enforce:
     - child cannot reference itself
     - child parent must be in same venue
     - parent cannot be set `is_multi_court=false` while children exist
     - when child is inserted/updated with `parent_court_id`, parent is automatically promoted to `is_multi_court=true`
   - This guarantees the bug cannot recur from any client path.

2. Fix manager form state model (`ManagerCourtFormNew.tsx`)
   - Remove direct `window.history.replaceState` usage.
   - Use a single active-court source (`selectedTabCourtId` fallback to route id), and derive panel state from active court + real child relationships.
   - Ensure “Add Sub-Court” flow keeps parent context stable and never reclassifies child as main in panel state.
   - Keep existing save paths intact, but guarantee parent multi-court state remains correct when creating children.

3. Multi-court UI behavior safeguards
   - Always show multi-court tabs when children exist (even for legacy inconsistent records).
   - Disable/harden turning off multi-court when children exist (with clear message).
   - Keep tab labeling deterministic: main court is always the root (no parent), sub-courts always children.

4. Availability resilience (backend function)
   - Update `get-availability` to include children when a requested court has child rows, even if `is_multi_court` flag is temporarily wrong.
   - This prevents booking UX breakage from legacy/inconsistent data and makes behavior relationship-driven.

5. Verification I will perform (not asking you to test manually)
   - DB checks:
     - verify parent `57e11168...` becomes `is_multi_court=true`
     - verify child links remain unchanged
     - verify no rows exist with `children > 0 AND is_multi_court=false`
   - Functional checks:
     - call `get-availability` for `57e11168...` and confirm `venue_courts` includes both main + child.
   - UI checks:
     - exercise add-sub-court flow and confirm:
       - main court remains main
       - child appears as child tab
       - subsequent saves update correct court record
       - no panel collapse/desync

Technical details:
- Files to update:
  - `supabase/migrations/<new>.sql`
  - `src/pages/manager/ManagerCourtFormNew.tsx`
  - `supabase/functions/get-availability/index.ts`
- No money/payment logic touched.
- No auth model changes.
- Existing routing and form schema preserved; this is a consistency + state synchronization fix.
