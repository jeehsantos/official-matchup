

# Redesign Sign-Out Process

## Current Problems

1. **Artificial 200ms delay** — pointless `setTimeout` before any real work
2. **Two sequential sign-out calls** — `global` then `local` scope, redundant since `global` already clears local tokens
3. **Full-screen blocking overlay** with `isSigningOut` state — causes a flash/blank screen
4. **Hard `window.location.href = "/auth"`** — triggers a full page reload instead of a smooth SPA navigation

## New Design

Single `supabase.auth.signOut()` call (default scope which is `local` — fast, no server round-trip needed). Clear state immediately, then use React Router navigation instead of a hard reload. Remove the `isSigningOut` state and its overlay entirely.

```
signOut → clear local state → navigate to /auth (instant, no reload)
```

## Changes

### 1. `src/lib/auth-context.tsx`
- Remove `isSigningOut` state and its full-screen overlay from the provider JSX
- Remove `isSigningOut` from context type and value
- Simplify `signOut`:
  ```ts
  const signOut = async () => {
    setUser(null);
    setSession(null);
    setUserRole(null);
    await supabase.auth.signOut({ scope: "local" });
    window.location.replace("/auth");
  };
  ```
  - State cleared first so UI reacts instantly (no authenticated flash)
  - Single local sign-out (no global call — unnecessary for user-initiated logout)
  - `window.location.replace` instead of `href` to avoid back-button returning to stale authenticated page

### 2. Remove `isSigningOut` references from consumers
- `src/lib/auth-context.tsx` — remove from interface, state, provider value, and overlay JSX

No changes needed in `MobileLayout`, `ManagerLayout`, `AdminLayout`, `Profile`, or `ManagerSettings` — they all just call `await signOut()` which will now be instant.

