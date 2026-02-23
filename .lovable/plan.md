## Fix: Payment Deadline Warning and Auto-Cancellation for All Court Types

### Status: ✅ Implemented

### Changes Made

#### 1. Database migration — `cancel_expired_unpaid_sessions` function
- Removed the `AND c.payment_timing = 'before_session'` filter
- Now catches any session where `payment_deadline < now()` regardless of court payment timing

#### 2. `src/components/booking/PaymentDeadlineWarning.tsx` (NEW)
- Reusable warning banner component with two modes: full card and compact
- Shows countdown timer before deadline, "deadline passed" message after
- Used by both GameDetail and QuickGameLobby pages

#### 3. `src/pages/GameDetail.tsx`
- Added `PaymentDeadlineWarning` after the payment card for organizers with pending payments

#### 4. `src/pages/QuickGameLobby.tsx`
- Added compact `PaymentDeadlineWarning` in central panel for organizers with pending payments
- Computes deadline from court's `payment_hours_before` and scheduled session time

#### 5. `src/hooks/useQuickChallenges.ts`
- Added `payment_timing` and `payment_hours_before` to the courts select query
- Updated `QuickChallenge` interface to include the new fields
