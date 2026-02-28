

## Problem Analysis

Two issues found:

### Issue 1: Quick Challenge — Credits added but frontend doesn't refresh
The backend correctly converts payments to credits (confirmed in DB: $150 balance, two $75 credit transactions). However, the `useCancelChallenge` hook only invalidates `quick-challenges` queries — it never invalidates `user-credits`, so the user's displayed balance doesn't update. The toast message also doesn't mention the credit conversion.

### Issue 2: Normal Session — No credit conversion on cancel
The `cancel_session_and_release_court` DB function only releases the court and marks the session cancelled. It does **not** refund paid players' court amounts as credits. This needs a new backend function (edge function) that:
1. Finds all completed payments for the session
2. Converts court_amount to credits for each paying user
3. Marks payments as `converted_to_credits`
4. Records held_credit_liabilities
5. Then cancels the session and releases the court

## Implementation Plan

### Step 1: Fix Quick Challenge frontend credit refresh
- In `src/hooks/useQuickChallenges.ts` (`useCancelChallenge`): also invalidate `user-credits` query key in `onSuccess`
- Update the success toast to include credit conversion info from the response data

### Step 2: Also fix `useLeaveChallenge` 
- Same issue: after leaving with credits, invalidate `user-credits` query key

### Step 3: Create `cancel-session` edge function
New backend function at `supabase/functions/cancel-session/index.ts` that:
- Authenticates the user
- Verifies user is the group organizer
- Loads all `completed` payments for the session
- For each payment: converts `court_amount` (cents → dollars) to credits via `add_user_credits` RPC
- Creates `held_credit_liabilities` entries
- Updates payment status to `converted_to_credits`
- Releases `court_availability` (reset `is_booked`, clear booking references)
- Removes all `session_players`
- Marks session `is_cancelled = true`

### Step 4: Update `GameDetail.tsx` to use new edge function
- Replace `supabase.rpc('cancel_session_and_release_court')` with `supabase.functions.invoke('cancel-session')`
- Invalidate `user-credits` query after successful cancellation
- Show toast with credit conversion info

### Step 5: Update `CourtDetail.tsx` cancel flow
- Same replacement of the RPC call with the new edge function for the Stripe-cancel cleanup path

### Technical Details
- The `add_user_credits` RPC checks `auth.uid()` — when called from edge functions with service role key, `auth.uid()` is NULL, which passes the guard (`IF auth.uid() IS NOT NULL AND NOT has_role(...)`)
- Credit amount = `court_amount / 100` (stored in cents)
- Service fee is non-refundable per existing policy
- Config: add `verify_jwt = false` for the new function in `supabase/config.toml`

