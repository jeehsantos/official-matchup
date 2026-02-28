

## Problem Root Cause

The referral record is **never created** in the database. Here's why:

1. After signup, `Auth.tsx` tries to insert a `referrals` row **client-side**
2. The RLS policy on `referrals` INSERT requires `auth.uid() = referred_user_id`
3. But at the point of insertion, the user session may not be fully established (email confirmation pending, session race condition)
4. The insert **silently fails** — no referral row exists
5. When `process_referral_credit` runs after payment, it finds no pending referral, so no credits are awarded

## Fix Plan

### Step 1: Pass referral code as signup metadata
In `Auth.tsx`, when calling `signUp()`, pass the stored referral code in the user metadata so it's available server-side during user creation.

### Step 2: Update `handle_new_user` trigger to create referral
Modify the `handle_new_user()` database trigger function (runs as SECURITY DEFINER, bypasses RLS) to:
- Check if `raw_user_meta_data` contains a `referral_code`
- Look up the referrer profile by that code
- Insert the `referrals` row with status `pending`

This is the most reliable approach because the trigger runs in the same transaction as user creation, with elevated privileges.

### Step 3: Pass referral code through auth context
Update `signUp()` in `auth-context.tsx` to accept an optional `referralCode` parameter and include it in `options.data`.

### Step 4: Clean up client-side referral code
Remove the now-redundant client-side referral insert logic from `Auth.tsx` (lines 168-193), keeping only the `localStorage` read to pass the code to `signUp()`.

### Technical Details
- The `handle_new_user` trigger is `SECURITY DEFINER` with `search_path = 'public'`, so it can insert into `referrals` without RLS restrictions
- The referral code is passed via `raw_user_meta_data.referral_code` which is set during `supabase.auth.signUp()`
- The `process_referral_credit` RPC (already called in stripe-webhook and create-payment) will then find the pending referral and award credits correctly
- No new edge function needed — leverages existing infrastructure

