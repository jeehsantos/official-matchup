

# Internationalization (i18n) Plan — Portuguese (Informal) + Browser Language Detection

## Recommended Approach: `react-i18next`

The industry standard for React i18n is **react-i18next** (+ **i18next** + **i18next-browser-languagedetector**). It provides:
- Automatic browser/OS language detection
- JSON-based translation files (easy to maintain and extend to new languages)
- A `useTranslation()` hook for components — minimal refactoring per file
- Namespace support to split translations by feature area

## Architecture

```text
src/
├── i18n/
│   ├── index.ts              ← i18next init + language detector config
│   └── locales/
│       ├── en/
│       │   ├── common.json   ← shared (nav, buttons, labels)
│       │   ├── landing.json
│       │   ├── auth.json
│       │   ├── booking.json
│       │   ├── manager.json
│       │   ├── admin.json
│       │   └── profile.json
│       └── pt/
│           ├── common.json   ← Portuguese (informal — "você", casual tone)
│           ├── landing.json
│           ├── auth.json
│           ├── booking.json
│           ├── manager.json
│           ├── admin.json
│           └── profile.json
```

## Implementation Steps

### 1. Install dependencies
Add `i18next`, `react-i18next`, and `i18next-browser-languagedetector`.

### 2. Create i18n configuration (`src/i18n/index.ts`)
- Initialize i18next with browser language detector
- Fallback language: `en`
- Detection order: `navigator` (browser/OS setting), then `localStorage` for user override
- Load all namespaces (common, landing, auth, booking, manager, admin, profile)

### 3. Create English translation files
Extract all hardcoded strings from every page and component into namespaced JSON files under `src/i18n/locales/en/`.

### 4. Create Portuguese translation files
Translate all strings into informal Brazilian/Portuguese under `src/i18n/locales/pt/`. Use "você" form, casual tone — no "Senhor/Senhora", no subjunctive formality.

### 5. Wire i18n into the app
- Import `src/i18n/index.ts` in `src/main.tsx`
- Wrap `<App />` with the i18n provider (react-i18next auto-provides via `I18nextProvider` or just the import is enough)

### 6. Refactor all pages and components
Replace every hardcoded string with `t('namespace:key')` calls using the `useTranslation` hook. This affects:

**Public pages:** Landing, About, Contact, Auth, NotFound, Courts, CourtDetail, PaymentSuccess
**Player pages:** Index, Discover, Games, GameDetail, Groups, GroupDetail, JoinGroup, QuickGameLobby, Profile, ProfileEdit, ArchivedSessions
**Manager pages:** All 11 manager pages + manager components (StaffAccessSection, StripeSetupAlert, dashboard components, etc.)
**Admin pages:** All 7 admin pages
**Layout components:** Header, Footer, BottomNav, GuestNavbar, GuestBottomNav, ManagerLayout, AdminLayout, NotificationDropdown
**Shared components:** BookingWizard, PaymentMethodDialog, CreditsDisplay, all card components, modals, etc.

### 7. Add language switcher (optional but recommended)
A small dropdown in the navbar/footer to let users manually override their detected language.

### 8. Format dates/numbers with locale
Update all `toLocaleDateString("en-US", ...)` and `format()` calls to use the current i18n locale instead of hardcoded `"en-US"`.

## Scope Note

This is a **large refactoring effort** spanning 60+ files. I recommend implementing it in phases:

1. **Phase 1**: Setup i18n infrastructure + translate layout/nav components + Landing + Auth + About + Contact pages
2. **Phase 2**: Player-facing pages (Courts, Games, Groups, Discover, Profile, Booking flows)
3. **Phase 3**: Manager pages and components
4. **Phase 4**: Admin pages

Each phase can be done in 1-2 messages. Shall I start with Phase 1?

