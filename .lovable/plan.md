

# Venue Landing Pages — `/venue/:slug`

## Summary
Add public venue landing pages accessible at `/venue/:slug` (e.g., `/venue/arena-sports-auckland`). Each venue gets a branded page showing all its courts, location map, amenities, and direct booking links. Admins manage slugs via a new admin page.

## Database Changes

### Add `slug` column to `venues` table
```sql
ALTER TABLE public.venues ADD COLUMN slug text UNIQUE;
CREATE INDEX idx_venues_slug ON public.venues(slug);
```

No new tables needed. The slug lives on the existing `venues` table. RLS already allows public SELECT on active venues.

### Admin slug management
Admins update slugs via a new admin page. Since admins use `has_role(auth.uid(), 'admin')`, we need an RLS policy allowing admins to update venues (currently only owners can). Add:
```sql
CREATE POLICY "Admins can update venues" ON public.venues
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
```

## New Pages

### 1. `src/pages/VenueLanding.tsx` — Public venue page
- Fetches venue by `slug` from `venues` table
- Fetches all active courts for that venue (excluding sub-courts via `parent_court_id IS NULL`)
- Layout sections:
  - **Hero**: Venue photo, name, city, description
  - **Courts grid**: Cards for each court with photo, sport icons, hourly rate, "Book Now" link to `/courts/:id`
  - **Info sidebar/section**: Address, phone, email, amenities list
  - **Location map**: Leaflet map centered on venue lat/lng (reuse existing map component pattern)
  - **Share button**: Copy URL to clipboard
- Uses `PublicLayout` wrapper (no auth required)
- Shows 404-style message if slug not found or venue inactive

### 2. `src/pages/admin/AdminVenueSlugs.tsx` — Admin slug management
- Lists all active venues with their current slug (or "No slug")
- Inline edit field to set/update slug per venue
- Auto-generate slug suggestion from venue name (kebab-case)
- Validation: lowercase, alphanumeric + hyphens only, unique check
- Uses `AdminLayout` wrapper

## Routing Changes (`src/App.tsx`)
```tsx
<Route path="/venue/:slug" element={<VenueLanding />} />
<Route path="/admin/venues" element={<AdminVenueSlugs />} />
```

## Admin Dashboard Update (`src/pages/admin/AdminDashboard.tsx`)
Add "Venue Pages" menu item linking to `/admin/venues`.

## Manager Venue Form Enhancement
Show the venue's public URL (`/venue/:slug`) in the venue edit form as a read-only shareable link if a slug is set. Managers can see but not edit the slug (admin-only).

## Files to Create/Edit
1. **Migration SQL** — add `slug` column, index, admin UPDATE policy
2. **`src/pages/VenueLanding.tsx`** — new public venue page
3. **`src/pages/admin/AdminVenueSlugs.tsx`** — new admin page
4. **`src/pages/admin/AdminDashboard.tsx`** — add menu item
5. **`src/App.tsx`** — add routes
6. **`src/pages/manager/ManagerVenueForm.tsx`** — show shareable link

