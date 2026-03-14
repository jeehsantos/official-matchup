

## Plan: Revamp Venue Edit & Add Court Flow on /manager/courts

### What changes

**1. Replace inline venue name edit with a Venue Edit Dialog on `/manager/courts`**

The pencil/edit button next to each venue name will open a Dialog (popup) instead of inline editing. This dialog will contain:
- **Venue Name** field (editable)
- **Court list with "Main Court" selection** — radio-style list of all courts in the venue, letting the manager designate which court is the main court (sets `parent_court_id = null` on the selected court and `parent_court_id = selectedMainId` on all others)
- **Delete Venue** button at the bottom with a red destructive style

**2. Update "Add Court" button logic on `/manager/courts`**

Instead of the current AlertDialog that asks the user to select a parent court:
- Check if the venue has a designated main court (a court with `parent_court_id = null` and `is_multi_court = true`, or simply the court that has no parent)
- If a main court exists: navigate directly to `/manager/courts/{mainCourtId}/edit?add_subcourt=true`
- If no main court is designated (e.g., venue has 1+ courts but none marked as main/multi-court): show a warning toast/alert saying "Please select a main court in the venue settings before adding a second court"
- If venue has zero courts: navigate to `/manager/courts/new?venue_id={venueId}` (existing behavior)

**3. Add Venue Delete with confirmation modal**

Inside the new Venue Edit Dialog, add a "Delete Venue" button that:
- Opens a confirmation AlertDialog
- Checks for active bookings across ALL courts in the venue before allowing deletion
- If no active bookings: deletes all courts, then the venue
- If active bookings exist: shows error message

**4. Remove the "Preview" section from `/manager/courts/{id}` edit page**

The Preview panel (venue name editor + multi-court config + court preview card) on the court edit page will be removed since this functionality moves to the venue edit dialog on `/manager/courts`. The court edit form (`ManagerCourtFormNew`) will keep only the form fields (court details, location, policies, photos). The multi-court tab navigation and sub-court management will remain on the edit page since it's needed for switching between courts.

### Files to modify

- **`src/pages/manager/ManagerCourtsNew.tsx`**: Replace inline venue name editing with Dialog trigger. Add VenueEditDialog component with venue name, main court selector, and delete venue. Update "Add Court" button to check for main court. Remove the old AlertDialog for parent court selection.

- **`src/pages/manager/ManagerCourtFormNew.tsx`**: Remove the Preview panel (desktop right column and MobilePreviewPanel). Keep multi-court tab navigation in the form area for court switching. Remove venue name editor from this page.

### Technical details

**Main court selection logic:**
- When the user selects a court as "main" in the dialog, update the database:
  - Set `is_multi_court = true` on the selected main court
  - Set `parent_court_id = null` on the main court  
  - Set `parent_court_id = mainCourtId` on all other courts in the venue
- When a venue has only 1 court, that court is implicitly the main court

**Venue deletion flow:**
```
1. Check court_availability where court_id IN (venue courts) AND is_booked = true
2. If count > 0 → block with error
3. If count = 0 → delete court_availability → delete courts → delete venue
```

**Add Court guard:**
- A venue needs a main court (court with `is_multi_court = true`) before adding sub-courts
- Single-court venues: the "Add Court" button should first prompt to set that court as main via the venue edit dialog

