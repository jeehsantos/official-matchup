

## Fix Session Price Display and Add Service Fee Visibility

### Problem
1. The per-player price shown on `/games` cards and `/games/{id}` detail page divides `court_price` by `min_players`, but the backend (`create-payment`) divides by `max_players` for split payments. This causes a mismatch between displayed and actual charge.
2. The platform service fee (from `platform_settings.player_fee`) is not shown anywhere on these pages, so users are surprised by the total at checkout.

### Solution

#### 1. Fix price calculation (Games.tsx + GameDetail.tsx)

For **split** payments: `court_price / max_players` (matching the backend).
For **organizer pays full**: show the full `court_price` (only to the organizer).

#### 2. Show service fee in price displays

Use the existing `usePlatformFee` hook to fetch the service fee and display a breakdown:
- **Court price** (per player share for split, full for organizer)
- **Service fee** (the `player_fee` value)
- **Total** = court share + service fee

#### 3. File Changes

**`src/pages/Games.tsx`**
- Import `usePlatformFee` hook
- Change line 166 from `session.court_price / (session.min_players || 1)` to `session.court_price / (session.max_players || 1)` for split, or full price for single
- Pass service fee info or total price to `GameCard`

**`src/components/cards/GameCard.tsx`**
- Accept optional `serviceFee` prop
- Display total (court share + service fee) instead of just court share
- Show "per player" label for split payments

**`src/pages/GameDetail.tsx`**
- Import and use `usePlatformFee` hook
- Fix `pricePerPlayer` on line 620 to use `max_players` instead of `min_players`
- Update all price displays to show breakdown: Court price, Service fee, Total
- Update payment button labels to show the correct total
- Fix `handleMakePayment` credits comparison on line 421 to use correct per-player amount
- Fix rescue join text on line 762

### Technical Details

The `usePlatformFee` hook already exists and returns `{ playerFee, managerFeePercentage, isLoading }`. The `playerFee` is the fixed service fee per transaction.

Key lines to update:
- `Games.tsx:166` -- price calculation
- `GameDetail.tsx:420-421` -- credits comparison uses wrong divisor
- `GameDetail.tsx:438` -- same wrong calculation
- `GameDetail.tsx:620` -- pricePerPlayer definition
- `GameDetail.tsx:762` -- rescue join price text
- `GameDetail.tsx:924-935` -- organizer payment display
- `GameDetail.tsx:954` -- pay button label
- `GameDetail.tsx:982` -- split price display
- `GameDetail.tsx:1000` -- split pay button label
- `GameCard.tsx` -- price display in card

No database changes required. No edge function changes required.

