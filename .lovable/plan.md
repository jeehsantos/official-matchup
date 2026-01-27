
# Plan: Replace `session_type` with `sport_category_id` in Sessions Table

## Overview
This improvement replaces the deprecated `session_type` enum column with a new `sport_category_id` column that references the `sport_categories` table as a foreign key. This aligns with the architecture mandate to use database-driven sport categories exclusively.

## Current State Analysis
- The `sessions` table has a `session_type` column using a PostgreSQL enum (`casual`, `competitive`, `training`, `private`, `tournament`)
- The `BookingWizard` already collects `sportCategoryId` from the user during booking
- However, this value is **not being saved** to the sessions table
- Pages like `GameDetail.tsx` and `Games.tsx` currently derive sport info from the `group.sport_type` instead of having it directly on the session

## Implementation Approach

### Phase 1: Database Migration (Backend First)

**Add the new column with foreign key reference:**
- Add `sport_category_id` column to `sessions` table as a UUID
- Create foreign key constraint referencing `sport_categories.id`
- Migrate existing data by mapping current `session_type` values to corresponding sport categories
- Keep `session_type` nullable during transition (can be deprecated later)

```text
┌─────────────────────────────────────────────────────────────────┐
│                     SESSIONS TABLE                              │
├─────────────────────────────────────────────────────────────────┤
│ + sport_category_id (UUID)  ─────────►  sport_categories.id     │
│   session_type (nullable, deprecated)                           │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SPORT_CATEGORIES TABLE                        │
├─────────────────────────────────────────────────────────────────┤
│ id (PK) │ name │ display_name │ icon │ is_active │ sort_order  │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 2: Update Session Creation (CourtDetail.tsx)

Modify `handleBookingConfirm` to include the `sport_category_id` when inserting a new session:

```
Current insert:
{
  group_id: groupId,
  court_id: bookingCourtId,
  session_date: dateStr,
  ...other fields
}

Updated insert:
{
  group_id: groupId,
  court_id: bookingCourtId,
  session_date: dateStr,
  sport_category_id: sportCategoryId,  // ◄── NEW
  ...other fields
}
```

### Phase 3: Update Session Display (GameCard, GameDetail, Games)

**Modify queries to include sport_category relation:**

1. **GameDetail.tsx** - Add `sport_categories` join to session query
2. **Games.tsx** - Fetch sport category directly from session instead of deriving from group
3. **GameCard.tsx** - Already accepts `sportCategory` prop; ensure it receives the data
4. **GroupDetail.tsx** - Update session list to show sport category from session

### Phase 4: Responsive & Performance Optimizations

- Add index on `sessions.sport_category_id` for query performance
- The sport category dropdown in BookingWizard is already responsive with proper touch targets
- Queries will join on indexed foreign key for optimal performance

---

## Technical Details

### Database Migration SQL

```sql
-- Add sport_category_id column to sessions table
ALTER TABLE public.sessions 
ADD COLUMN sport_category_id UUID REFERENCES public.sport_categories(id);

-- Create index for performance
CREATE INDEX idx_sessions_sport_category_id 
ON public.sessions(sport_category_id);

-- Migrate existing sessions: Map session_type to default sport category 
-- (use 'futsal' as default since most sessions have 'casual' session_type)
UPDATE public.sessions 
SET sport_category_id = (
  SELECT id FROM public.sport_categories 
  WHERE name = 'futsal' LIMIT 1
)
WHERE sport_category_id IS NULL;
```

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/CourtDetail.tsx` | Add `sport_category_id` to session insert |
| `src/pages/GameDetail.tsx` | Join sport_categories in query, use session's category |
| `src/pages/Games.tsx` | Fetch sport_category from session, remove group derivation |
| `src/pages/GroupDetail.tsx` | Update session list rendering to use session's category |
| `src/components/cards/GameCard.tsx` | Already handles sportCategory prop (no change needed) |

### Updated Query Pattern

```typescript
// Before (deriving from group):
const { data: sessionData } = await supabase
  .from("sessions")
  .select(`*, courts (*), groups (*)`)
  .eq("id", id);

const sportCategory = await getSportCategory(groupData.sport_type);

// After (direct from session):
const { data: sessionData } = await supabase
  .from("sessions")
  .select(`*, courts (*), groups (*), sport_categories (*)`)
  .eq("id", id);

const sportCategory = sessionData.sport_categories; // Direct access
```

### BookingWizard Validation

The wizard already validates sport category selection. If none is selected, it auto-selects the first available category. This ensures the field is never null when creating a session.

---

## Expected Results

1. **Session Creation**: When a player books a court, the selected Sport Category is saved to the session's `sport_category_id` column

2. **Session Display**: Game cards and detail pages show the sport selected during booking, not a hardcoded default

3. **Data Integrity**: Foreign key constraint ensures only valid sport categories can be assigned

4. **Performance**: Indexed join provides fast lookups without additional queries

5. **Backward Compatibility**: Existing sessions will be migrated to have a default sport category (futsal)
