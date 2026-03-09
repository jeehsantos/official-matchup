import { Link } from "react-router-dom";
import { GuestNavbar } from "@/components/layout/GuestNavbar";
import { Footer } from "@/components/layout/Footer";
import { ArrowLeft } from "lucide-react";

export default function Cookies() {
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
          <h1 className="font-display text-4xl font-bold">Cookie Policy</h1>
          <p className="text-muted-foreground">Last updated: 9 March 2026</p>

          <h2>What Are Cookies?</h2>
          <p>
            Cookies are small text files stored on your device by your web browser. They help websites remember
            information between page visits.
          </p>

          <h2>How We Use Cookies and Local Storage</h2>
          <p>Sport Arena uses only <strong>essential</strong> cookies and browser local storage. We do not use any tracking, analytics, or advertising cookies.</p>

          <table>
            <thead>
              <tr>
                <th>Technology</th>
                <th>Purpose</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Local Storage — Auth Session</td>
                <td>Keeps you signed in between visits</td>
                <td>Until you sign out</td>
              </tr>
              <tr>
                <td>Local Storage — Theme Preference</td>
                <td>Remembers your light/dark mode choice</td>
                <td>Persistent</td>
              </tr>
              <tr>
                <td>Local Storage — Language</td>
                <td>Remembers your language preference (English/Portuguese)</td>
                <td>Persistent</td>
              </tr>
            </tbody>
          </table>

          <h2>Third-Party Cookies</h2>
          <p>
            When you make a payment, you are redirected to Stripe's checkout page. Stripe may set its own cookies
            as described in their{" "}
            <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              privacy policy
            </a>.
            These cookies are managed by Stripe, not by Sport Arena.
          </p>

          <h2>Managing Cookies</h2>
          <p>
            Since we only use essential storage for core functionality, disabling cookies or local storage may
            prevent you from signing in or using the platform properly. You can clear your browser's local storage
            at any time through your browser settings.
          </p>

          <h2>Contact</h2>
          <p>
            If you have questions about our cookie practices, please see our{" "}
            <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link> or{" "}
            <Link to="/contact" className="text-primary hover:underline">contact us</Link>.
          </p>
        </div>
      </article>

      <Footer />
    </div>
  );
}
