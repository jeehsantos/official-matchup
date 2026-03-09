

## NZ Privacy Act 2020 Compliance Review

The NZ Privacy Act 2020 has **13 Information Privacy Principles (IPPs)**. After reviewing the codebase against these principles, here are the gaps and required fixes:

---

### Current Compliance Status

| IPP | Principle | Status | Issue |
|-----|-----------|--------|-------|
| 1 | Purpose of collection | Missing | No privacy policy explaining why data is collected |
| 2 | Source of information | OK | Data collected directly from users |
| 3 | Collection from subject | Missing | No notice at point of collection (signup/contact) |
| 4 | Manner of collection | OK | Standard web forms, not intrusive |
| 5 | Storage & security | Partial | Good RLS/encryption, but no breach notification process |
| 6 | Access to own data | Missing | Users cannot export/download their personal data |
| 7 | Correction of data | Partial | Profile editing exists, but no formal correction request process |
| 8 | Accuracy before use | OK | Data used as provided |
| 9 | Retention | Missing | No data retention policy, no account deletion |
| 10 | Use limitation | Missing | No stated limits on how data is used |
| 11 | Disclosure limitation | Partial | RLS protects data, but no policy stating disclosure rules |
| 12 | Unique identifiers | OK | UUIDs used, no government IDs stored |
| 13 | Cross-border disclosure | Missing | No disclosure that data may be stored overseas (Supabase infrastructure) |

---

### Required Changes

#### 1. Privacy Policy Page (IPPs 1, 3, 5, 9, 10, 11, 13)
Create a full `/privacy` page covering:
- What personal data is collected (name, email, phone, city, nationality, gender, payment info)
- Why it's collected (account, bookings, groups, payments)
- How it's stored and secured
- Data retention periods
- Cross-border data disclosure (cloud infrastructure)
- Third-party sharing (Stripe for payments)
- User rights under the Privacy Act 2020

#### 2. Terms of Service Page (IPPs 1, 10)
Create a `/terms` page covering:
- Acceptable use
- Service fee policy
- Credits and refund policy
- Account termination

#### 3. Cookie Policy Page
Create a `/cookies` page explaining sidebar state cookie usage.

#### 4. Fix Footer Links
Update `Footer.tsx` — the Privacy, Terms, and Cookies links currently point to `#` (dead links). Route them to the new pages.

#### 5. Fix Landing Footer Links
Update `Landing.tsx` — privacy/terms links point to `#privacy` and `#terms` anchors on the About page, which don't exist.

#### 6. Signup Consent Notice (IPP 3)
Add a consent statement at signup: "By creating an account, you agree to our Terms of Service and Privacy Policy" with links to both pages.

#### 7. Account Data Export (IPP 6)
Add a "Download My Data" button to the Profile page that calls a backend function to export user's personal data (profile, bookings, payments, credits, groups) as JSON.

#### 8. Account Deletion (IPP 9)
Add a "Delete My Account" option in the Profile page that:
- Calls a backend function to anonymize/delete user data
- Removes profile, group memberships, and personal information
- Preserves financial records in anonymized form (legal requirement)

#### 9. Contact Form Privacy Notice (IPP 3)
Add a brief notice on the Contact page: "We collect your name and email to respond to your inquiry. See our Privacy Policy for details."

---

### Technical Implementation

| Change | Files |
|--------|-------|
| Privacy Policy page | New `src/pages/Privacy.tsx`, route in `App.tsx` |
| Terms of Service page | New `src/pages/Terms.tsx`, route in `App.tsx` |
| Cookie Policy page | New `src/pages/Cookies.tsx`, route in `App.tsx` |
| Footer links fix | `src/components/layout/Footer.tsx` |
| Landing links fix | `src/pages/Landing.tsx` |
| Signup consent | `src/pages/Auth.tsx` |
| Contact notice | `src/pages/Contact.tsx` |
| Data export | New edge function `export-user-data`, Profile page button |
| Account deletion | New edge function `delete-user-account`, Profile page button |
| Translation files | `en/common.json`, new `en/privacy.json`, `en/terms.json` |

