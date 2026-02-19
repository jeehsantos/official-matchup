## Problem Summary

When a court manager configures payment timing as "Before Session" with a specific hours-before deadline, the system does not enforce this deadline. Unpaid bookings remain in "pending" status indefinitely, blocking the slot from being rebooked.

Two issues need fixing:

1. **Payment deadline is hardcoded to 24 hours** instead of using the court's `payment_hours_before` setting
2. **No automated enforcement** -- there is no background process that cancels unpaid bookings when the deadline passes

## Plan

### 1. Fix payment deadline calculation in CourtDetail.tsx

Currently (line 682-683):

```typescript
const paymentDeadline = new Date(slotDate);
paymentDeadline.setHours(paymentDeadline.getHours() - 24);
```

This must use the court's actual `payment_hours_before` value and calculate from the session start datetime (not just the date):

```typescript
const sessionStart = new Date(`${dateStr}T${startTime}`);
const hoursBeforeSession = court.payment_hours_before || 24;
const paymentDeadline = new Date(sessionStart.getTime() - hoursBeforeSession * 60 * 60 * 1000);
```

### 2. Create a database function to cancel expired unpaid bookings

A new RPC function `cancel_expired_unpaid_sessions` will:

- Find sessions where:
  - `payment_status = 'pending'` on `court_availability`
  - The court has `payment_timing = 'before_session'`
  - `NOW()` is past the session's `payment_deadline`
  - Session is not already cancelled
- For each expired session:
  - Mark the session as cancelled (`is_cancelled = true`)
  - Release the court slot (`is_booked = false`, clear booking references)
  - Remove session players
  - Clean up related chat conversations

### 3. Create a new edge function `cancel-expired-bookings`

A lightweight edge function that calls the `cancel_expired_unpaid_sessions` RPC. This can be triggered via cron (similar to `expire-holds`).

### 4. Schedule a cron job

Set up a `pg_cron` + `pg_net` schedule to call `cancel-expired-bookings` every 15 minutes, ensuring timely enforcement.

### 5. Enforce "at_booking" payment for same-day rebookings

When a user books a slot on the same day and the remaining time is less than the court's `payment_hours_before`, the booking flow should force `payment_timing = 'at_booking'` regardless of the court's default. This prevents a new "before_session" booking that would immediately be past its deadline.

This will be handled in:

- **CourtDetail.tsx**: Before opening the BookingWizard, check if the slot's session start minus `payment_hours_before` is already in the past. If so, override `paymentTiming` to `"at_booking"` and show a notice.
- **BookingWizard.tsx**: Display an info alert when payment timing has been overridden.

### 6. Frontend notification for cancelled bookings (optional enhancement)

When a session is cancelled by the automated process, the database function will insert a notification into the `notifications` table for the organizer, warning them their booking was cancelled due to non-payment.  
A warning in the session page should also be displayed to the organizer user before getting the booking session cancelled.

## Technical Details

### Database migration (new function + cron)

```sql
CREATE OR REPLACE FUNCTION public.cancel_expired_unpaid_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INTEGER := 0;
  v_session RECORD;
BEGIN
  FOR v_session IN
    SELECT s.id AS session_id, s.group_id, ca.id AS ca_id,
           g.organizer_id
    FROM sessions s
    JOIN court_availability ca ON ca.booked_by_session_id = s.id
    JOIN courts c ON c.id = s.court_id
    JOIN groups g ON g.id = s.group_id
    WHERE s.is_cancelled = false
      AND ca.is_booked = true
      AND ca.payment_status = 'pending'
      AND c.payment_timing = 'before_session'
      AND s.payment_deadline < now()
  LOOP
    -- Release court slot
    UPDATE court_availability
    SET is_booked = false,
        booked_by_session_id = NULL,
        booked_by_group_id = NULL,
        booked_by_user_id = NULL,
        payment_status = 'pending'
    WHERE id = v_session.ca_id;

    -- Remove session players
    DELETE FROM session_players WHERE session_id = v_session.session_id;

    -- Cancel session
    UPDATE sessions SET is_cancelled = true WHERE id = v_session.session_id;

    -- Notify organizer
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      v_session.organizer_id,
      'session_cancelled',
      'Booking Cancelled - Payment Overdue',
      'Your booking was automatically cancelled because payment was not received before the deadline.',
      jsonb_build_object('session_id', v_session.session_id)
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
```

### Edge function: `supabase/functions/cancel-expired-bookings/index.ts`

Calls `supabase.rpc("cancel_expired_unpaid_sessions")` and returns the count of cancelled sessions.

### Cron schedule (via insert tool, not migration)

```sql
SELECT cron.schedule(
  'cancel-expired-unpaid-bookings',
  '*/15 * * * *',
  $$ SELECT net.http_post(
    url:='<functions_url>/cancel-expired-bookings',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <anon_key>"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id; $$
);
```

### Frontend override logic in CourtDetail.tsx

Before opening the booking wizard, check:

```typescript
const sessionStart = new Date(`${dateStr}T${startTime}`);
const hoursBeforeSession = court.payment_hours_before || 24;
const deadlineTime = new Date(sessionStart.getTime() - hoursBeforeSession * 60 * 60 * 1000);
const effectivePaymentTiming =
  court.payment_timing === 'before_session' && new Date() >= deadlineTime
    ? 'at_booking'
    : court.payment_timing;
```

### Files to create/modify


| File                                                        | Action                              |
| ----------------------------------------------------------- | ----------------------------------- |
| `supabase/migrations/...cancel_expired_unpaid_sessions.sql` | Create DB function                  |
| `supabase/functions/cancel-expired-bookings/index.ts`       | New edge function                   |
| `src/pages/CourtDetail.tsx` (lines 682-683)                 | Fix deadline calc + override timing |
| `src/components/booking/BookingWizard.tsx`                  | Add alert for overridden timing     |
| Cron job (via insert tool)                                  | Schedule every 15 minutes           |
