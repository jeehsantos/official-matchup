
## Email Confirmation Implementation Plan

I will update the authentication flow to gracefully handle mandatory email confirmation, ensuring users are forced to verify their email before accessing the platform.

### 1. Update Authentication Context
I will modify `src/lib/auth-context.tsx` so the `signUp` function returns the newly created `session` (if any). When email confirmation is required by the backend, Supabase returns the created user but no active session. I will use this distinction to prevent auto-logging the user in immediately after they register.

### 2. Update Auth Interface (`src/pages/Auth.tsx`)
- **Signup Flow**: After a successful signup, I will check if a session was established. If not (meaning confirmation is pending), I will show a success toast telling the user to "Check your email to activate your account," clear the form, and switch them back to the Login tab instead of redirecting them to the dashboard.
- **Login Flow**: I will intercept the specific "Email not confirmed" error from Supabase during the login process and display a friendly, translated error message reminding the user to verify their email.

### 3. Update Translations
I will add the required English and Portuguese translations to `src/i18n/locales/en/auth.json` and `pt/auth.json` for the new UI states:
- "Please verify your email address to log in."
- "Confirmation link sent"
- "Please check your email and click the link to activate your account."

### Important Note on Configuration
For this to actively prevent logins, **"Confirm Email" must be enabled in your Lovable Cloud Auth settings** (via the Backend settings menu). The frontend changes I'm making will seamlessly adapt based on this setting—so if it's ON, it will enforce confirmation, and if you ever turn it OFF, users will automatically be logged in again.
