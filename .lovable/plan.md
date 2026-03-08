

## Sign-Out Flow Fix

### Problem

The sign-out flow causes a visible redirect chain: current page → `/auth` → `/` (landing). This happens because:

1. `signOut()` in `auth-context.tsx` sets `user` to `null` immediately, then calls `window.location.href = '/'`
2. Before the full page reload takes effect, React re-renders — any `ProtectedRoute` wrapper sees `user === null` and calls `navigate("/auth")`
3. Meanwhile, callers (MobileLayout, Profile, ManagerLayout, ManagerSettings) also call `navigate("/", { replace: true })` after `await signOut()`, adding another competing navigation
4. Finally `window.location.href = '/'` fires, doing the full reload to landing

### Solution

**Remove all `navigate()` calls after `signOut()`** in every caller. The `window.location.href = '/'` in `auth-context.tsx` already handles the redirect with a clean full-page reload, which is the correct approach (clears all in-memory state).

### Files to Edit

1. **`src/components/layout/MobileLayout.tsx`** — Remove `navigate("/", { replace: true })` from `handleSignOut`
2. **`src/pages/Profile.tsx`** — Same
3. **`src/pages/manager/ManagerSettings.tsx`** — Same
4. **`src/components/layout/ManagerLayout.tsx`** — Same
5. **`src/components/layout/AdminLayout.tsx`** — Same (already doesn't navigate, but verify)

Each handler becomes simply:
```typescript
const handleSignOut = async () => {
  await signOut();
};
```

No database changes. No new files. Single-concept fix across 4-5 files.

