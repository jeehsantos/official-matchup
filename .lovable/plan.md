

## Unified Players Section with Integrated Waitlist

### What changes

Replace the current separate cards (Rescue Mode controls, Player Count, Confirmed Players list, Waiting List) with a single unified "Players" card matching the screenshot design.

### File: `src/pages/GameDetail.tsx`

**1. Remove these separate sections** (lines ~840-1344):
- Organizer Rescue Controls card (lines 841-880)
- Join Rescue Session card (lines 882-909)
- Player Count card (lines 1184-1218)
- Confirmed Players card (lines 1220-1299)
- Waiting List card (lines 1301-1344)

**2. Replace with a single unified Players card** containing:

**Header row:**
- `Players` label with `{players.length} / {session.max_players}` count
- Rescue Mode toggle (Switch component) with tooltip on hover: "Allow external players to fill empty spots"
- Toggle only visible to organizer when game is not past

**Progress bar:**
- Reuse `PlayerCount` logic inline (progress bar + "Need X more to confirm" message)

**Confirmed section:**
- "Confirmed ({players.length})" subheading
- List of players with avatar, name + nationality flag, payment status badge (Pending Payment / Confirmed with green dot)
- Each player row: avatar fallback initials, name with "(You)" tag, flag inline, status indicator on right

**Empty spots indicator:**
- Show remaining spots as a row: icon + "X Spots Available"

**Waitlist section** (shown when `waitingList.length > 0`):
- "Waitlist ({count})" subheading with "QUEUE" label on right
- Each waitlisted player: avatar, name, "Joined Xh ago" subtitle, queue position `#N` on right
- No payment button for waitlisted users

**Edit Player Limits button:**
- At bottom, only for organizer

**3. Join logic update:**
- When `players.length >= session.max_players` AND user is not in session/waitlist, allow joining to waitlist instead of blocking
- Show toast: "You've been added to the waiting list"
- `handleJoinSession` should still insert into `session_players` — the existing slice logic at line 202 already handles waitlist separation based on `max_players`

**4. Waitlist user restrictions:**
- `isInWaitingList` users see no payment button (already partially implemented)
- Remove the disabled "Waiting List" button from the payment card; instead show a subtle badge "You're on the waitlist"

**5. Import Switch and Tooltip** components (already available in project)

### Waitlist promotion on leave

The existing `handleLeaveSession` already removes the player. After removal and `fetchGameData()`, the slice logic (`playersWithProfiles.slice(0, max_players)`) automatically promotes the first waitlisted player to the confirmed list. The promoted player will then see the appropriate payment button on their next visit.

No backend changes needed — the waitlist is purely positional based on `joined_at` ordering and `max_players` threshold.

### Summary of sections in the new unified card

```text
┌─────────────────────────────────────────────┐
│ 👥 Players  1/10       ⓘ Rescue Mode [toggle]│
│ ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ Need 5 more players to confirm session       │
│                                              │
│ Confirmed (1)                                │
│ ┌──────────────────────────────────────────┐ │
│ │ [JT] Jeff test (You)              ●green │ │
│ │      ⚠ Pending Payment                  │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ 👥 9 Spots Available                         │
│                                              │
│ Waitlist (2)                        QUEUE    │
│ ┌──────────────────────────────────────────┐ │
│ │ [AS] Alex Smith                      #1  │ │
│ │      Joined 1h ago                       │ │
│ │ [MG] Maria Garcia                   #2  │ │
│ │      Joined 3h ago                       │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│         [⚙ Edit Player Limits]               │
└─────────────────────────────────────────────┘
```

