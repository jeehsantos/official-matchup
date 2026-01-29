
# Quick Challenge Booking Flow Implementation Plan

## ✅ Implementation Complete

The Quick Challenge flow has been implemented and is now separate from the normal booking process:

1. **ManagerLayout TypeScript Error** - Fixed by adding explicit type annotation to `mobileNavItems`
2. **QuickChallengeWizard** - Created new 3-step wizard at `src/components/booking/QuickChallengeWizard.tsx`
3. **CourtDetail Quick Game Detection** - Updated to detect `quickGame` URL param and show appropriate wizard
4. **Courts Quick Game Banner** - Added banner showing quick game mode is active

## Original Problem Analysis

1. **Current Flow Issue**: After selecting sport + game mode in `QuickGameModal`, users are redirected to `/courts?quickGame=true` but the normal booking flow (which creates a Group + Session) is triggered
2. **Key Difference**: Quick Challenges should NOT create a group - they create a standalone `quick_challenges` record where external players can join
3. **Build Error**: There's also a TypeScript error in `ManagerLayout.tsx` at line 214 that needs fixing first

## Proposed Solution

Create a **dedicated Quick Challenge Booking Wizard** that follows a distinct flow from the normal group-based booking.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                        QUICK CHALLENGE FLOW                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Player clicks "Quick Game" button on /discover                           │
│                     ▼                                                        │
│  2. QuickGameModal: Select Sport Category + Game Mode (1vs1 to 5vs5)        │
│                     ▼                                                        │
│  3. Redirect to /courts?quickGame=true&sport=futsal                          │
│                     ▼                                                        │
│  4. Player selects a court → Opens CourtDetail                               │
│                     ▼                                                        │
│  5. Player selects date + time slot → Clicks "Book"                          │
│                     ▼                                                        │
│  6. DETECT quickGame=true → Open QuickChallengeWizard (NOT BookingWizard)   │
│                     ▼                                                        │
│  7. Step 1: Terms & Rules (accept court rules)                               │
│                     ▼                                                        │
│  8. Step 2: Equipment (optional equipment rental)                            │
│                     ▼                                                        │
│  9. Step 3: Payment Choice                                                   │
│       - Pay full amount (organizer pays everything upfront)                  │
│       - Split between players (each player pays their share)                 │
│                     ▼                                                        │
│  10. Confirm Booking → Creates quick_challenges + court_availability records │
│                     ▼                                                        │
│  11. Lobby is available for external players to join at /discover            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Phase 1: Fix Build Error

**File**: `src/components/layout/ManagerLayout.tsx`

The issue is at line 214 where TypeScript can't infer the icon type correctly when `action` is `"signout"`. The fix is to add an explicit type annotation to the `mobileNavItems` array.

### Phase 2: Detect Quick Game Mode in CourtDetail

**File**: `src/pages/CourtDetail.tsx`

1. Read `quickGame` parameter from URL
2. Check `sessionStorage.quickGameConfig` for sport category and game mode
3. When user clicks "Book", check if in quick game mode:
   - If YES → Open `QuickChallengeWizard`
   - If NO → Open existing `BookingWizard`

### Phase 3: Create QuickChallengeWizard Component

**New File**: `src/components/booking/QuickChallengeWizard.tsx`

A 3-step wizard tailored for Quick Challenges:

| Step | Title | Content |
|------|-------|---------|
| 1 | Terms & Rules | Display court rules, require acceptance |
| 2 | Equipment | Optional equipment rental selector |
| 3 | Payment | Pay Full Amount OR Split Between Players |

**Key Differences from BookingWizard**:
- NO group selection/creation
- NO sport category selection (already selected in QuickGameModal)
- Payment split is per-player based on total_slots

### Phase 4: Quick Challenge Creation Logic

When the user confirms in the wizard:

1. **Create `quick_challenges` record**:
   - `sport_category_id`: from sessionStorage config
   - `game_mode`: from sessionStorage config (e.g., "2vs2")
   - `venue_id`: from court.venue_id
   - `court_id`: selected court
   - `scheduled_date`: selected date
   - `scheduled_time`: selected start time
   - `price_per_player`: calculated based on total price / total_slots
   - `total_slots`: from game mode (e.g., 4 for 2vs2)
   - `status`: "open"
   - `created_by`: current user

2. **Create `court_availability` record**:
   - Mark the slot as booked
   - `booked_by_user_id`: current user
   - `is_booked`: true
   - `payment_status`: pending

3. **Auto-add creator as first player**:
   - Insert into `quick_challenge_players`
   - `team`: "left"
   - `slot_position`: 0
   - `payment_status`: "pending" (or "paid" if paying now)

4. **Handle Payment**:
   - If "Pay Full Amount": Redirect to Stripe for full court price
   - If "Split": Each player pays `price_per_player` when joining

### Phase 5: Update Courts.tsx to Handle Filters

**File**: `src/pages/Courts.tsx`

Read the `quickGame` and `sport` query parameters:
- Display a banner indicating Quick Game mode is active
- Pre-filter courts by sport if provided

### Phase 6: Clear Quick Game State After Booking

After successful quick challenge creation:
- Clear `sessionStorage.quickGameConfig`
- Navigate to `/discover?filter=quickgames` or show the new challenge

## Database Schema Confirmation

The existing `quick_challenges` table schema supports this flow:

| Column | Type | Purpose |
|--------|------|---------|
| sport_category_id | UUID | Links to sport_categories |
| game_mode | TEXT | "1vs1", "2vs2", etc. |
| venue_id | UUID | Venue where court is located |
| court_id | UUID | Selected court |
| scheduled_date | DATE | Booking date |
| scheduled_time | TIME | Start time |
| price_per_player | NUMERIC | Cost per player slot |
| total_slots | INTEGER | Total player positions |
| created_by | UUID | User who created challenge |
| status | TEXT | "open", "full", "completed" |

## Technical Details

### QuickChallengeWizard Props

```typescript
interface QuickChallengeWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: {
    paymentType: "single" | "split";
    equipment: SelectedEquipment[];
  }) => void;
  // Court/Venue info
  courtId: string;
  courtName: string;
  courtRules: string | null;
  venueId: string;
  venueName: string;
  venueAddress: string;
  courtPrice: number;
  // Slot info
  slotDate: string;
  startTime: string;
  endTime: string;
  // Quick game config
  sportCategoryId: string;
  sportName: string;
  gameMode: string;
  totalPlayers: number;
  // Equipment
  equipment: Equipment[];
  selectedEquipment: SelectedEquipment[];
  onEquipmentChange: (equipment: SelectedEquipment[]) => void;
  // Payment
  paymentTiming: "at_booking" | "before_session" | null;
}
```

### Price Calculation for Split Payment

```typescript
// Calculate price per player for split payment
const totalCost = courtPrice + equipmentTotal;
const pricePerPlayer = Math.ceil((totalCost / totalPlayers) * 100) / 100;
```

### Responsive Design Requirements

The wizard will follow the same responsive patterns as `BookingWizard`:
- Mobile: Full-width dialog with safe area padding
- Desktop: Centered modal with max-width
- Touch-friendly buttons (min 44px touch targets)
- Skeleton loaders for async data

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/layout/ManagerLayout.tsx` | Modify | Fix TypeScript build error |
| `src/components/booking/QuickChallengeWizard.tsx` | Create | New 3-step wizard for quick challenges |
| `src/pages/CourtDetail.tsx` | Modify | Add quick game mode detection and routing |
| `src/pages/Courts.tsx` | Modify | Add quick game mode banner and sport filter |
| `src/components/quick-challenge/QuickGameModal.tsx` | Modify | Minor cleanup if needed |

## Expected Results

1. **Distinct Flow**: Quick Challenge booking is completely separate from group-based booking
2. **No Group Creation**: Quick Challenges don't create groups, only `quick_challenges` records
3. **Lobby Visibility**: After creation, the challenge appears in "Quick Games" tab on /discover
4. **Player Joining**: Other players can join vacant slots and pay their share
5. **Real-time Updates**: TanStack Query + Supabase Realtime keeps the lobby synced
