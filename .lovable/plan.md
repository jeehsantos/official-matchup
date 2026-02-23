## Fix: Payment Deadline Warning and Auto-Cancellation for All Court Types

### Problem

The screenshot shows a session on **Court B** (Kiwi Arena Sports) scheduled for **Feb 24 at 19:00** with `payment_timing: at_booking` and `payment_hours_before: 24`. The payment deadline is **Feb 24 03:00 UTC**, which is already overdue. Two things are broken:

1. **No warning banner** is displayed to the organizer on the Game Detail page to inform them their booking will be cancelled if not paid before the deadline.
2. **Auto-cancellation not triggered** -- the `cancel_expired_unpaid_sessions` database function only checks for `payment_timing = 'before_session'`, so `at_booking` courts with overdue unpaid sessions are never cancelled.

### Solution

#### 1. Fix the auto-cancellation function to handle ALL payment timings

Update `cancel_expired_unpaid_sessions` to remove the `payment_timing = 'before_session'` filter, so it catches any session where the `payment_deadline` has passed and payment is still pending. This covers both `before_session` and `at_booking` courts.

#### 2. Add a payment deadline warning banner on the Game Detail and Quick Lobby page

When the organizer views a session or a Quick game session with a pending payment and a `payment_deadline` approaching (or already past), display a prominent warning banner:

- **Before deadline**: "Payment must be completed by [date/time] or your booking will be automatically cancelled."
- **After deadline (if cron hasn't run yet)**: "Payment deadline has passed. Your booking will be cancelled shortly."

### Technical Details

**Database migration** -- Update the `cancel_expired_unpaid_sessions` function:

- Remove the `AND c.payment_timing = 'before_session'` filter
- Keep the `AND s.payment_deadline < now()` check (works for all timings)
- This ensures the existing cron job (runs every 15 minutes) picks up overdue sessions regardless of court payment timing

**Frontend -- `src/pages/GameDetail.tsx**`:

- After the payment card section, compute whether the session has a `payment_deadline` and whether the organizer's payment is pending
- If the deadline is within 24 hours or already passed, render an `AlertTriangle` warning card with the deadline details
- Use `date-fns` `format` and `isPast` (already imported) for date logic  
- Display warning only to the organizer user   
  
`src/pages/QuickGameLobby.tsx`:  

  - After the payment card section, compute whether the session has a `payment_deadline` and whether the organizer's payment is pending
  - If the deadline is within 24 hours or already passed, render an `AlertTriangle` warning card with the deadline details
  - Use `date-fns` `format` and `isPast` (already imported) for date logic  
  - Display warning only to the organizer user 

**No changes needed** to the edge function `cancel-expired-bookings/index.ts` or the cron job -- they already invoke the RPC correctly.