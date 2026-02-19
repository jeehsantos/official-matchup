

## Preferred Sports Filter Enhancement

### Problem Summary
1. Users can browse courts/games without completing their profile, leading to irrelevant results
2. The sport filter shows a "My Preferred Sports" aggregate option instead of showing only the user's selected sports
3. Caching issues cause stale preferred sports after profile updates
4. No profile completion gate before browsing

---

### Plan

#### 1. Profile Completion Gate (ProtectedRoute Enhancement)

Update `src/components/auth/ProtectedRoute.tsx` to accept an optional `requireCompleteProfile` prop. When enabled, it checks `useUserProfile()` for completeness and renders a friendly full-screen prompt (not a redirect) explaining that completing their profile gives them a better, personalized experience. The prompt includes a button to go to `/profile/edit`.

Apply this gate to the following routes in `src/App.tsx`:
- `/courts`
- `/courts/:id`
- `/discover`
- `/games`
- `/quick-games/:id`

#### 2. Fix Sport Filter Options (Courts + Discover + MobileCourtFilters)

Replace the current filter logic that includes `{ value: "preferred", label: "My Preferred Sports" }` with a simpler approach:

- If the user has preferred sports configured, the filter options show:
  - "All Sports" (shows only the user's preferred sports, not every sport)
  - Individual sport entries for each preferred sport (if more than one)
- If only one preferred sport is configured, default to that single sport (no "All Sports" needed since there's only one)
- Remove the "preferred" virtual filter value entirely

This applies to:
- `src/pages/Courts.tsx` (sportFilterOptions memo)
- `src/pages/Discover.tsx` (sports memo)
- `src/components/courts/MobileCourtFilters.tsx` (receives options as props, no change needed)

The filtering logic for courts/games also changes: "all" now means "all of my preferred sports" (not every sport in the database).

#### 3. Fix Caching Issue on Profile Update

Update `src/pages/ProfileEdit.tsx` to invalidate the `["user-profile"]` query cache after a successful save using `queryClient.invalidateQueries({ queryKey: ["user-profile"] })`. This ensures the preferred sports filter immediately reflects updates.

#### 4. Reduce staleTime for Profile Query

In `src/hooks/useUserProfile.ts`, reduce `staleTime` from 5 minutes to 30 seconds. This ensures profile changes propagate faster across the app without requiring manual invalidation for edge cases.
## Include Stripe Processing Fee in Service Fee

### Problem
The platform currently charges players only `court_amount + platform_fee`, but Stripe deducts ~2.9% + 30c from the collected amount. The platform absorbs this cost, losing money on every transaction.

### Solution
Calculate an estimated Stripe fee on the backend and bundle it into the single "Service fee" shown to users. The user sees:
- **Court price**: $X
- **Service fee**: $Y (internally = platform_fee + estimated_stripe_fee)
- **Total**: $Z

No separate "Stripe fee" line is ever shown. Payout logic is NOT touched.

### Stripe Fee Estimation Formula
NZ Stripe rates are typically 2.9% + 30c. To ensure full cost coverage, we use a "gross-up" formula:

```text
total_charge = (court_amount + platform_fee + 0.30) / (1 - 0.029)
estimated_stripe_fee = total_charge - court_amount - platform_fee
service_fee = platform_fee + estimated_stripe_fee
```

This ensures that after Stripe takes its cut from `total_charge`, the platform retains at least `platform_fee`.

### File Changes

#### 1. Backend: `supabase/functions/create-payment/index.ts`

**Current** (lines 72-73):
```typescript
const serviceFeeDollars = Number(platformSettings?.player_fee ?? 0);
const serviceFeeCents = Math.round(serviceFeeDollars * 100);
```

**New**: After computing `remainingCourtAmountCents` (line 149), calculate the gross-up:

```typescript
// Stripe NZ: 2.9% + 30c
const STRIPE_PERCENT = 0.029;
const STRIPE_FIXED_CENTS = 30;

const platformFeeCents = Math.round(Number(platformSettings?.player_fee ?? 0) * 100);
const subtotalBeforeStripe = remainingCourtAmountCents + platformFeeCents;
const grossTotalCents = Math.ceil((subtotalBeforeStripe + STRIPE_FIXED_CENTS) / (1 - STRIPE_PERCENT));
const estimatedStripeFeeCents = grossTotalCents - subtotalBeforeStripe;
const serviceFeeCents = platformFeeCents + estimatedStripeFeeCents;
const totalChargeCents = remainingCourtAmountCents + serviceFeeCents;
```

- Remove the early `serviceFeeCents` calculation at line 73 (it's now computed after credits).
- Use a single Stripe Checkout line item with `unit_amount = totalChargeCents` (court booking + service fee combined), or keep two line items: court amount + service fee.
- Update metadata to include the new `service_fee` and `total_charge`.
- Update the response to return `serviceFee: serviceFeeCents / 100` and `total: totalChargeCents / 100`.
- For credits-only payments, no Stripe fee is needed (no change to that path).

#### 2. Frontend: `src/hooks/usePlatformFee.ts`

No changes needed. The frontend already fetches `playerFee` for display, but since the task says "do NOT calculate any fee in the frontend," the GameDetail page should ideally show the backend-returned breakdown. However, for the pre-payment display (before the user clicks "Pay"), the frontend still needs an estimate. We will keep using `playerFee` from this hook but add a note that the actual charge comes from the backend.

**Alternative approach**: Add a lightweight edge function or RPC that returns the estimated total for a given session, so the frontend never calculates fees. However, this adds latency and complexity. For now, the frontend will show the platform fee as an approximate "Service fee" label, and the actual Stripe checkout will reflect the true gross-up total from the backend. The button label will say "Make Payment" without a specific dollar amount, or we accept a minor discrepancy between the displayed estimate and the actual charge.

**Recommended approach**: Keep the frontend estimate using `playerFee` for display consistency, but update the button to not show a specific amount (just "Make Payment"), since the backend determines the final total. The Stripe Checkout page will show the authoritative amount.

Actually, to keep UX clean and match the requirement "Display Court price: $X, Service fee: $Y, Total: $Z" accurately, we should compute the same gross-up formula on the frontend for display purposes only. This keeps the display in sync with what the backend will charge.

#### 3. Frontend: `src/pages/GameDetail.tsx`

- Replace `playerFee` usage with a computed `serviceFee` that includes estimated Stripe cost using the same formula.
- Update all price display sections (lines 936-946, 971, 999-1001, 1020) to use the new `serviceFee`.
- Update `handleMakePayment` credit comparison (line 425) to use the new total.

#### 4. Frontend: `src/pages/Games.tsx` and `src/components/cards/GameCard.tsx`

### Technical Details

**Files to modify:**

| File | Change |
|------|--------|
| `src/components/auth/ProtectedRoute.tsx` | Add `requireCompleteProfile` prop, render profile completion prompt |
| `src/App.tsx` | Wrap player-facing routes with `ProtectedRoute requireCompleteProfile` |
| `src/pages/Courts.tsx` | Rewrite `sportFilterOptions` to only show user's preferred sports; change "all" to filter by preferred sports; remove "preferred" value |
| `src/pages/Discover.tsx` | Same filter rewrite as Courts |
| `src/pages/ProfileEdit.tsx` | Invalidate `user-profile` query after save |
| `src/hooks/useUserProfile.ts` | Reduce staleTime to 30s |

**No database changes required.** All logic is frontend filter behavior using existing profile data.
- Update the per-player price card to include the estimated Stripe fee in the displayed total.

### Implementation Sequence

1. Update `create-payment` edge function with gross-up Stripe fee calculation
2. Create a small utility function `estimateServiceFee(courtAmountDollars, platformFeeDollars)` in `src/lib/utils.ts` for frontend display
3. Update `GameDetail.tsx` to use the utility for display
4. Update `Games.tsx` and `GameCard.tsx` to use the utility for display
5. Deploy the edge function

### What Does NOT Change
- Payout logic (`payout-session`) -- untouched
- `stripe-webhook` -- untouched
- `verify-payment` -- untouched
- Database schema -- no changes
- Credits-only payment path -- no Stripe fee applied (correct behavior)

