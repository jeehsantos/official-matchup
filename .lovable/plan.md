

## Weekly Cleanup: Cancelled Quick Challenges & Orphaned Court Availability

### Safety Analysis

**`quick_challenges` (status = 'cancelled', older than 2 weeks):**
- All child tables (`quick_challenge_players`, `quick_challenge_payments`, `quick_challenge_messages`, `quick_challenge_bans`) use `ON DELETE CASCADE` — children are automatically removed
- Cancelled challenges have already had payments converted to credits (handled by `cancel-quick-challenge` edge function)
- No edge function queries cancelled challenges for active processing — they're only queried with filters like `status IN ('open', 'full', 'pending_payment')`
- **SAFE to delete**

**`court_availability` (payment_status = 'pending', date older than 2 weeks):**
- These are slots that were reserved but never paid for — orphaned records
- The `cancel_expired_unpaid_sessions` RPC already cancels sessions linked to unpaid slots, so by 2 weeks any linked session is already cancelled
- Adding `available_date < current_date - 14 days` ensures we only touch historical records
- Edge functions only query `court_availability` for current/future dates
- **SAFE to delete**

### Implementation

**1. New Database Function: `purge_old_cancelled_records()`**

```sql
CREATE OR REPLACE FUNCTION public.purge_old_cancelled_records()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_challenges INTEGER;
  v_slots INTEGER;
BEGIN
  -- Delete cancelled quick challenges older than 2 weeks (cascades to players, payments, messages, bans)
  DELETE FROM public.quick_challenges
  WHERE status = 'cancelled'
    AND created_at < now() - interval '14 days';
  GET DIAGNOSTICS v_challenges = ROW_COUNT;

  -- Delete orphaned court_availability with pending payment older than 2 weeks
  DELETE FROM public.court_availability
  WHERE payment_status = 'pending'
    AND available_date < current_date - interval '14 days';
  GET DIAGNOSTICS v_slots = ROW_COUNT;

  RETURN jsonb_build_object(
    'purged_challenges', v_challenges,
    'purged_slots', v_slots
  );
END;
$$;
```

**2. Update `expire-holds` Edge Function**
Add the purge call alongside the existing `purge_old_booking_holds` call — piggyback on the same scheduled invocation.

**3. No new cron job needed** — reuses the existing `expire-holds` schedule.

### Files to Modify
| File | Change |
|------|--------|
| Migration | Create `purge_old_cancelled_records()` function |
| `supabase/functions/expire-holds/index.ts` | Add call to new purge function |

