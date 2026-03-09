

## Booking Holds Table Cleanup Plan

### Current State
- **50 EXPIRED** records (oldest from Feb 28)
- **8 CONVERTED** records
- The existing `expire_stale_holds` RPC only marks holds as `EXPIRED` but never deletes them
- Over time, this table will grow unbounded

### Solution: Weekly Purge of Old Terminal Holds

**Records safe to delete:**
- Status `EXPIRED` older than 7 days (no longer needed)
- Status `CONVERTED` older than 7 days (booking already created)
- Status `FAILED` older than 7 days (payment failed, no retry possible)

Records with status `HELD` should **never** be deleted (active holds).

---

### Implementation

**1. New Database Function: `purge_old_booking_holds()`**
```sql
CREATE OR REPLACE FUNCTION purge_old_booking_holds()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_count INTEGER;
BEGIN
  DELETE FROM booking_holds
  WHERE status IN ('EXPIRED', 'CONVERTED', 'FAILED')
    AND created_at < now() - interval '7 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
```

**2. Update `expire-holds` Edge Function**
Add the purge call after expiring stale holds:
```typescript
// After expire_stale_holds...
const { data: purged } = await supabase.rpc("purge_old_booking_holds");
console.log(`Purged ${purged} old holds`);
```

**3. Set Up Weekly Cron Job (pg_cron)**
Schedule via SQL insert to run every Sunday at 3:00 AM UTC.

---

### Files to Modify
| File | Change |
|------|--------|
| Migration | Create `purge_old_booking_holds()` function |
| `supabase/functions/expire-holds/index.ts` | Add purge call after expiring holds |
| SQL insert (pg_cron) | Schedule weekly cleanup cron |

### Safety Notes
- Only terminal statuses (`EXPIRED`, `CONVERTED`, `FAILED`) are deleted
- 7-day retention allows debugging recent issues
- `HELD` status records are never touched
- No impact on other processes—this table is self-contained

