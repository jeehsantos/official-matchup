
## Security Remediation Review - Regression Issues Found

After reviewing the security changes, I identified **4 critical regressions** that need immediate fixes:

---

### Issue 1: JoinGroup.tsx - BROKEN (Critical)
**Location:** `src/pages/JoinGroup.tsx` lines 49-54, 120-131

**Problem:** The page still directly queries the `group_invitations` table, but we dropped the public SELECT/UPDATE RLS policies. This will cause the join flow to fail completely.

**Fix:**
- Replace direct table query with the `get_group_invitation` RPC (lines 49-54)
- Replace direct UPDATE with `increment_invitation_use` RPC (lines 120-131)

---

### Issue 2: GroupDetail.tsx - BROKEN Logic
**Location:** `src/pages/GroupDetail.tsx` lines 188-197

**Problem:** Code attempts to call `get_group_invitation` RPC with an empty string `p_invite_code: ""`, which is invalid and will always return `INVITE_NOT_FOUND`.

**Fix:**
- Remove the broken RPC call
- Organizers should query their own invitations directly via the organizer-specific INSERT permission (they need to generate new invites, not fetch old ones through this path)

---

### Issue 3: send-contact-email Edge Function - MISSING RATE LIMITING
**Location:** `supabase/functions/send-contact-email/index.ts`

**Problem:** The security fix for contact form abuse prevention was NOT implemented. The function has no protection against spam attacks.

**Fix:**
- Add IP-based in-memory rate limiting (3 requests per 5 minutes per IP)
- Add input validation with length limits

---

### Issue 4: useQuickChallenges.ts - Unnecessary Data Fetch
**Location:** `src/hooks/useQuickChallenges.ts` lines 85-86

**Problem:** Still fetches `stripe_session_id` which is now protected by Column-Level Security. While it won't error (returns NULL), it's cleaner to remove from the select.

**Fix:**
- Remove `stripe_session_id` from the select statement

---

## Implementation Summary

| File | Issue | Severity | Fix |
|------|-------|----------|-----|
| `JoinGroup.tsx` | Direct DB access fails | 🔴 Critical | Use RPCs |
| `GroupDetail.tsx` | Invalid RPC call | 🟠 High | Remove broken code |
| `send-contact-email/index.ts` | No rate limiting | 🔴 Critical | Add rate limiter |
| `useQuickChallenges.ts` | Redundant field | 🟢 Low | Clean up select |

---

## Technical Details

### JoinGroup.tsx Changes
```typescript
// Replace direct query with RPC
const { data: result } = await supabase.rpc("get_group_invitation", { 
  p_invite_code: code 
});
if (!result?.success) {
  setError(result?.error === 'INVITE_NOT_FOUND' ? t("inviteInvalidOrExpired") : ...);
  return;
}
const invitation = result.invitation;
const groupData = result.group;

// Replace direct UPDATE with RPC
await supabase.rpc("increment_invitation_use", { p_invite_code: code });
```

### Rate Limiting for Contact Form
```typescript
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || record.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (record.count >= RATE_LIMIT) return false;
  record.count++;
  return true;
}
```
