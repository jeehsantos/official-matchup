

# Add Nationality Selection and Display Feature

## Overview

Add a searchable nationality dropdown to the Profile page and display nationality flags next to player names in Quick Challenge lobbies and session views.

## What Will Change

### For You (the Player)
- **Profile Page**: A new "Nationality" field in Personal Information section
- **Searchable Dropdown**: Type to quickly find your country from 200+ options
- **Flag Display**: Your nationality flag will appear as a small rounded image next to your name when other players see you

### Where Flags Will Appear
- Quick Game lobby player cards (next to name)
- Session player lists
- Any other location where player names are shown

---

## Technical Implementation

### Phase 1: Database Update

Add `nationality_code` column to the `profiles` table:

| Column | Type | Purpose |
|--------|------|---------|
| nationality_code | TEXT | ISO 3166-1 alpha-2 code (e.g., "NZ", "BR", "US") |

The migration will:
- Add nullable `nationality_code` column
- No default value (users choose their nationality)

### Phase 2: Create Country Data File

Create a new data file with all countries and their ISO codes:

**File**: `src/data/countries.ts`

Contains:
- All countries with ISO alpha-2 codes
- Pre-sorted alphabetically
- Unicode flag emoji generation from code

Example structure:
```typescript
export interface Country {
  code: string;      // "NZ"
  name: string;      // "New Zealand"
  flag: string;      // "🇳🇿"
}

export const countries: Country[] = [
  { code: "AF", name: "Afghanistan", flag: "🇦🇫" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿" },
  // ... 200+ countries
];
```

### Phase 3: Create Nationality Combobox Component

**File**: `src/components/ui/nationality-combobox.tsx`

Features:
- Searchable dropdown using existing `cmdk` library
- Type-ahead filtering by country name
- Shows flag + country name in dropdown options
- Selected value displays flag + country name
- Accessible with keyboard navigation

Uses existing components:
- `Popover` + `PopoverTrigger` + `PopoverContent`
- `Command` + `CommandInput` + `CommandList` + `CommandItem`
- `Button` for trigger

### Phase 4: Update Profile Pages

**File**: `src/pages/Profile.tsx` - Personal Information section

Add nationality field after the City dropdown:
- Label: "Nationality"
- Component: `NationalityCombobox`
- Helper text: "Your flag will be shown to other players"

**File**: `src/pages/ProfileEdit.tsx`

Same changes as Profile.tsx for consistency.

### Phase 5: Update Profile Data Handling

Both Profile and ProfileEdit pages:
- Add `nationality_code` to `ProfileData` interface
- Include in fetch query
- Include in save/upsert operations

### Phase 6: Update Player Data Fetching

**File**: `src/hooks/useQuickChallenges.ts`

Update profile select query:
```typescript
// Before
.select("user_id, full_name, avatar_url, city")

// After
.select("user_id, full_name, avatar_url, city, nationality_code")
```

Update `QuickChallengePlayer` interface to include:
```typescript
profiles?: {
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  nationality_code: string | null;  // NEW
} | null;
```

### Phase 7: Pass Nationality to Components

**File**: `src/pages/QuickGameLobby.tsx`

```typescript
// Before
nationalityCode: null,

// After
nationalityCode: p.profiles?.nationality_code || null,
```

**File**: `src/pages/Discover.tsx`

Same pattern when mapping quick challenge players to card props.

### Phase 8: PlayerCard Already Supports Flags

The `PlayerCard.tsx` component already has:
- `getFlagEmoji()` function that converts country codes to flag emoji
- Display logic for the flag next to the player name

Current implementation shows flag in top-left corner. Based on the reference image, we may adjust to show it inline next to the player's name at the bottom of the card instead.

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| Database Migration | Create | Add `nationality_code` column to profiles |
| `src/data/countries.ts` | Create | Country list with ISO codes |
| `src/components/ui/nationality-combobox.tsx` | Create | Searchable country selector |
| `src/pages/Profile.tsx` | Modify | Add nationality field to Personal Information |
| `src/pages/ProfileEdit.tsx` | Modify | Add nationality field |
| `src/hooks/useQuickChallenges.ts` | Modify | Fetch nationality_code from profiles |
| `src/pages/QuickGameLobby.tsx` | Modify | Pass nationality to player cards |
| `src/pages/Discover.tsx` | Modify | Pass nationality to player cards |
| `src/components/quick-challenge/PlayerCard.tsx` | Modify | Adjust flag position to match design |

---

## User Experience

1. **Go to Profile** > Open "Personal Information" section
2. **See new Nationality field** with a searchable dropdown
3. **Click dropdown** > Type country name (e.g., "Braz...") > Select "Brazil"
4. **Save changes** > Profile updated
5. **Join a Quick Challenge** > Your flag (🇧🇷) appears next to your name
6. **Other players see** your flag when viewing the lobby

---

## Design Details (Based on Reference Image)

The reference image shows:
- Player name displayed below avatar (e.g., "Rafael N.")
- Small circular flag shown inline to the right of the name
- Flag appears as a small rounded badge/circle

The current `PlayerCard.tsx` shows the flag in the top-left corner. I will adjust to:
- Move flag display to inline with the player name
- Render flag as a small circular element next to the name
- Keep the emoji flag approach (works across all devices without images)

