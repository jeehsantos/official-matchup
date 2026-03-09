
## Plan: Admin User Management Page

### What needs to be built

A new admin page at `/admin/users` that lets the admin:
1. View all registered users (email, name, role, email confirmed status, joined date)
2. Activate/confirm a user's email without requiring real email verification
3. Edit basic user info (full name, role)

### Why an Edge Function is required

The `auth.users` table (where `email_confirmed_at` lives) is NOT accessible via the standard client SDK with RLS. It requires the `service_role` key, which must only be used server-side in an Edge Function. This matches the existing pattern used in `manage-venue-staff/index.ts`.

### Files to create/modify

**1. New Edge Function: `supabase/functions/manage-users/index.ts`**

Handles three actions, all admin-only (verified server-side via `has_role` check):
- `list` — fetches all users from `auth.admin.listUsers()`, joins with `profiles` and `user_roles` tables
- `activate` — sets `email_confirmed_at` on a user via `auth.admin.updateUserById()`
- `update` — updates `full_name` in `profiles` and `role` in `user_roles`

**2. New Page: `src/pages/admin/AdminUsers.tsx`**

UI features:
- Table with columns: Name, Email, Role, Email Confirmed (badge), Joined Date, Actions
- Search/filter by name or email
- "Activate" button (shown only when email is NOT confirmed) — calls `activate` action
- "Edit" button — opens a dialog to edit full name and role
- Pagination (50 users per page)

**3. Update `src/components/layout/AdminLayout.tsx`**

Add "Users" nav item with `Users` icon at `/admin/users`.

**4. Update `src/pages/admin/AdminDashboard.tsx`**

Add "User Management" card to the dashboard grid.

**5. Update `src/App.tsx`**

Add route: `<Route path="/admin/users" element={<AdminUsers />} />`

**6. Update `supabase/config.toml`**

Add `verify_jwt = false` for the new `manage-users` function.

### Security

- The edge function validates the caller's JWT and checks `has_role(caller_id, 'admin')` via a DB query before performing any operation
- `service_role` key is never exposed to the frontend
- No user can activate or edit others unless they are an admin

### Data flow

```text
Admin UI
  → supabase.functions.invoke("manage-users", { action: "list"|"activate"|"update", ... })
  → Edge Function validates JWT + checks admin role
  → Uses service_role to call auth.admin API
  → Returns sanitized user list / success response
  → UI re-renders table
```
