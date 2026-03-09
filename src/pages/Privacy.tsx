import { Link } from "react-router-dom";
import { GuestNavbar } from "@/components/layout/GuestNavbar";
import { Footer } from "@/components/layout/Footer";
import { ArrowLeft } from "lucide-react";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <GuestNavbar />
      <div className="px-4 pt-28">
        <div className="container mx-auto max-w-3xl">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </div>

      <article className="py-10 px-4">
        <div className="container mx-auto max-w-3xl prose prose-neutral dark:prose-invert">
          <h1 className="font-display text-4xl font-bold">Privacy Policy</h1>
          <p className="text-muted-foreground">Last updated: 9 March 2026</p>

          <p>
            Sport Arena ("we", "us", "our") is committed to protecting your privacy in accordance with the
            <strong> New Zealand Privacy Act 2020</strong> and the 13 Information Privacy Principles (IPPs).
            This policy explains how we collect, use, store and disclose your personal information.
          </p>

          <h2>1. What Information We Collect (IPP 1 &amp; 2)</h2>
          <p>We collect information directly from you when you:</p>
          <ul>
            <li>Create an account — full name, email address, password</li>
            <li>Complete your profile — phone number, city, nationality, gender, preferred sports</li>
            <li>Make bookings or payments — booking details, payment confirmation via Stripe (we do not store card numbers)</li>
            <li>Join groups or quick challenges — membership and participation data</li>
            <li>Contact us — name, email, subject, and message content</li>
          </ul>
          <p>We do not collect information about you from third parties unless you sign in via Google OAuth, in which case Google provides your name and email with your consent.</p>

          <h2>2. Purpose of Collection (IPP 1 &amp; 3)</h2>
          <p>We collect your personal information to:</p>
          <ul>
            <li>Create and manage your account</li>
            <li>Facilitate court bookings, group sessions, and quick challenges</li>
            <li>Process payments and manage credits/refunds</li>
            <li>Send notifications about your games, payments and groups</li>
            <li>Respond to your enquiries via the contact form</li>
            <li>Improve our platform and user experience</li>
          </ul>

          <h2>3. How We Store and Protect Your Data (IPP 5)</h2>
          <p>Your data is stored securely using industry-standard measures:</p>
          <ul>
            <li>Encrypted database with Row-Level Security (RLS) ensuring users can only access their own data</li>
            <li>Passwords are hashed using bcrypt and never stored in plaintext</li>
            <li>All connections use HTTPS/TLS encryption</li>
            <li>Payment processing handled by Stripe — we never see or store your card details</li>
            <li>Login attempt throttling and account lockout to prevent brute-force attacks</li>
          </ul>
          <p>
            In the event of a data breach that poses a risk of harm, we will notify affected individuals and the
            Office of the Privacy Commissioner as required under Part 6 of the Privacy Act 2020.
          </p>

          <h2>4. Data Retention (IPP 9)</h2>
          <ul>
            <li><strong>Account data:</strong> Retained while your account is active. You may request deletion at any time.</li>
            <li><strong>Financial records:</strong> Payment and transaction records are retained for 7 years as required by NZ tax law (Tax Administration Act 1994), in anonymised form after account deletion.</li>
            <li><strong>Contact messages:</strong> Retained for 12 months, then deleted.</li>
            <li><strong>Session/booking history:</strong> Archived data is automatically cleaned up after the retention period.</li>
          </ul>

          <h2>5. Use Limitation (IPP 10)</h2>
          <p>
            We only use your personal information for the purposes described in this policy. We do not sell your data
            to third parties. We do not use your data for marketing purposes unless you explicitly opt in.
          </p>

          <h2>6. Disclosure (IPP 11)</h2>
          <p>We may disclose your information to:</p>
          <ul>
            <li><strong>Stripe:</strong> Payment processor for processing court bookings and payouts to venue managers</li>
            <li><strong>Other users:</strong> Your name, nationality flag, and city are visible to other players in groups and game sessions you participate in</li>
            <li><strong>Venue managers:</strong> Booking details are visible to the venue where you booked a court</li>
            <li><strong>Law enforcement:</strong> If required by NZ law or court order</li>
          </ul>

          <h2>7. Cross-Border Disclosure (IPP 13)</h2>
          <p>
            Our platform infrastructure is hosted on cloud servers which may be located outside New Zealand
            (including the United States and the European Union). We ensure that any overseas service providers
            offer comparable privacy protections. Stripe processes payments in accordance with their own
            privacy policy and PCI-DSS compliance standards.
          </p>

          <h2>8. Your Rights</h2>
          <p>Under the Privacy Act 2020, you have the right to:</p>
          <ul>
            <li><strong>Access your data (IPP 6):</strong> You can download all your personal data from your Profile page using the "Download My Data" feature.</li>
            <li><strong>Correct your data (IPP 7):</strong> You can edit your profile information at any time. For corrections to payment records, contact us.</li>
            <li><strong>Delete your account (IPP 9):</strong> You can request account deletion from your Profile page. Financial records will be anonymised and retained as required by law.</li>
          </ul>

          <h2>9. Cookies</h2>
          <p>
            We use essential cookies and local storage to maintain your login session and theme preference.
            We do not use tracking or advertising cookies. See our{" "}
            <Link to="/cookies" className="text-primary hover:underline">Cookie Policy</Link> for details.
          </p>

          <h2>10. Changes to This Policy</h2>
          <p>
            We may update this policy from time to time. Material changes will be communicated via a notice
            on our website. The "Last updated" date at the top of this page indicates the most recent revision.
          </p>

          <h2>11. Contact Us</h2>
          <p>
            If you have questions about this policy or wish to make a privacy request, contact our Privacy Officer:
          </p>
          <ul>
            <li>Email: <a href="mailto:privacy@sportarena.nz" className="text-primary hover:underline">privacy@sportarena.nz</a></li>
            <li>Post: Sport Arena, Auckland, New Zealand</li>
          </ul>
          <p>
            You also have the right to complain to the{" "}
            <a href="https://www.privacy.org.nz" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Office of the Privacy Commissioner
            </a>.
          </p>
        </div>
      </article>

      <Footer />
    </div>
  );
}
