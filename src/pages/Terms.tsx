import { Link } from "react-router-dom";
import { GuestNavbar } from "@/components/layout/GuestNavbar";
import { Footer } from "@/components/layout/Footer";
import { ArrowLeft } from "lucide-react";

export default function Terms() {
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
          <h1 className="font-display text-4xl font-bold">Terms of Service</h1>
          <p className="text-muted-foreground">Last updated: 9 March 2026</p>

          <p>
            These Terms of Service ("Terms") govern your use of the Sport Arena platform operated by Sport Arena Limited
            ("we", "us", "our"), a company registered in New Zealand. By creating an account or using our services, you
            agree to these Terms.
          </p>

          <h2>1. Eligibility</h2>
          <p>
            You must be at least 16 years old to create an account. By using Sport Arena, you represent that you meet
            this age requirement and that the information you provide is accurate.
          </p>

          <h2>2. Account Responsibilities</h2>
          <ul>
            <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
            <li>You must not share your account with others or create multiple accounts.</li>
            <li>You must provide accurate information in your profile. Misleading profiles may be suspended.</li>
          </ul>

          <h2>3. Bookings and Payments</h2>
          <ul>
            <li>Court bookings are subject to availability and venue-specific rules.</li>
            <li>Prices displayed include the court fee and a service fee. The service fee covers platform operation and payment processing costs.</li>
            <li>Payments are processed securely via Stripe. We do not store your payment card details.</li>
            <li>Booking confirmations are only valid once payment has been verified by our payment processor.</li>
          </ul>

          <h2>4. Service Fees</h2>
          <p>
            A service fee is applied to each booking. This fee is non-refundable and covers platform maintenance
            and payment processing costs. The exact fee is displayed before you confirm any booking.
          </p>

          <h2>5. Credits and Refunds</h2>
          <ul>
            <li>When a session is cancelled, the court amount is converted to platform credits.</li>
            <li>Credits can be used for future bookings and do not incur additional service fees.</li>
            <li>Service fees are non-refundable.</li>
            <li>Credits have no cash value and cannot be transferred to other users or withdrawn.</li>
          </ul>

          <h2>6. Groups and Sessions</h2>
          <ul>
            <li>Group organisers are responsible for managing their group sessions and members.</li>
            <li>Players must honour their session commitments. Repeated no-shows may result in penalties.</li>
            <li>Group organisers may ban members at their discretion.</li>
          </ul>

          <h2>7. Venue Managers</h2>
          <ul>
            <li>Venue managers must provide accurate information about their courts and availability.</li>
            <li>Payouts are processed to the Stripe account linked to the venue after sessions are completed.</li>
            <li>Venue managers must comply with all applicable NZ laws regarding their facilities.</li>
          </ul>

          <h2>8. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the platform for any unlawful purpose</li>
            <li>Harass, abuse, or threaten other users</li>
            <li>Attempt to access other users' accounts or data</li>
            <li>Interfere with the platform's operation or security</li>
            <li>Submit false or misleading information</li>
          </ul>

          <h2>9. Account Termination</h2>
          <p>
            You may delete your account at any time from your Profile page. We may suspend or terminate accounts
            that violate these Terms. Upon deletion, your personal data will be removed or anonymised in accordance
            with our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
          </p>

          <h2>10. Limitation of Liability</h2>
          <p>
            Sport Arena is a booking platform. We are not liable for the quality or safety of venues, courts, or
            activities booked through our platform. To the maximum extent permitted by the New Zealand Consumer
            Guarantees Act 1993 and the Fair Trading Act 1986, our liability is limited to the fees you have paid us.
          </p>

          <h2>11. Governing Law</h2>
          <p>
            These Terms are governed by the laws of New Zealand. Any disputes will be subject to the exclusive
            jurisdiction of the courts of New Zealand.
          </p>

          <h2>12. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. Continued use of the platform after changes constitutes
            acceptance of the updated Terms. Material changes will be communicated via email or platform notification.
          </p>

          <h2>13. Contact</h2>
          <p>
            For questions about these Terms, please <Link to="/contact" className="text-primary hover:underline">contact us</Link> or
            email <a href="mailto:hello@sportarena.nz" className="text-primary hover:underline">hello@sportarena.nz</a>.
          </p>
        </div>
      </article>

      <Footer />
    </div>
  );
}
