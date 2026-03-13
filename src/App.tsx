import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/hooks/useTheme";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import JoinGroup from "./pages/JoinGroup";
import Groups from "./pages/Groups";
import Discover from "./pages/Discover";
import Games from "./pages/Games";
import GameDetail from "./pages/GameDetail";
import GroupDetail from "./pages/GroupDetail";
import Profile from "./pages/Profile";
import ProfileEdit from "./pages/ProfileEdit";
import NotFound from "./pages/NotFound";
import Landing from "./pages/Landing";
import About from "./pages/About";
import Contact from "./pages/Contact";
import QuickGameLobby from "./pages/QuickGameLobby";
import Courts from "./pages/Courts";
import CourtDetail from "./pages/CourtDetail";
import PaymentSuccess from "./pages/PaymentSuccess";
import ManagerDashboard from "./pages/manager/ManagerDashboard";
import ManagerVenues from "./pages/manager/ManagerVenues";
import ManagerVenueForm from "./pages/manager/ManagerVenueForm";
import ManagerCourts from "./pages/manager/ManagerCourts";
import ManagerCourtForm from "./pages/manager/ManagerCourtForm";
import ManagerCourtsNew from "./pages/manager/ManagerCourtsNew";
import ManagerCourtFormNew from "./pages/manager/ManagerCourtFormNew";
import ManagerAvailability from "./pages/manager/ManagerAvailability";
import ManagerSettings from "./pages/manager/ManagerSettings";
import ManagerEquipment from "./pages/manager/ManagerEquipment";
import ManagerBookings from "./pages/manager/ManagerBookings";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminSportCategories from "./pages/admin/AdminSportCategories";
import AdminSurfaceTypes from "./pages/admin/AdminSurfaceTypes";
import AdminArchiving from "./pages/admin/AdminArchiving";
import AdminReferralSettings from "./pages/admin/AdminReferralSettings";
import AdminPlatformFees from "./pages/admin/AdminPlatformFees";
import AdminFinance from "./pages/admin/AdminFinance";
import AdminVenueSlugs from "./pages/admin/AdminVenueSlugs";
import AdminUsers from "./pages/admin/AdminUsers";
import VenueLanding from "./pages/VenueLanding";
import VenueDirectory from "./pages/VenueDirectory";
import ArchivedSessions from "./pages/ArchivedSessions";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Cookies from "./pages/Cookies";

const queryClient = new QueryClient({});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/landing" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/groups" element={<Groups />} />
              <Route path="/groups/:id" element={<GroupDetail />} />
              <Route path="/join/:code" element={<JoinGroup />} />
              <Route path="/discover" element={<ProtectedRoute requireCompleteProfile><Discover /></ProtectedRoute>} />
              <Route path="/quick-games/:id" element={<ProtectedRoute requireCompleteProfile><QuickGameLobby /></ProtectedRoute>} />
              <Route path="/games" element={<ProtectedRoute requireCompleteProfile><Games /></ProtectedRoute>} />
              <Route path="/games/:id" element={<GameDetail />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/edit" element={<ProfileEdit />} />
              <Route path="/courts" element={<Courts />} />
              <Route path="/courts/:id" element={<CourtDetail />} />
              <Route path="/payment-success" element={<PaymentSuccess />} />
              {/* Manager Routes */}
              <Route path="/manager" element={<ProtectedRoute allowedRoles={["court_manager", "venue_staff"]}><ManagerDashboard /></ProtectedRoute>} />
              <Route path="/manager/venues" element={<ProtectedRoute allowedRoles={["court_manager", "venue_staff"]}><ManagerVenues /></ProtectedRoute>} />
              <Route path="/manager/venues/new" element={<ProtectedRoute allowedRoles={["court_manager", "venue_staff"]}><ManagerVenueForm /></ProtectedRoute>} />
              <Route path="/manager/venues/:venueId/edit" element={<ProtectedRoute allowedRoles={["court_manager", "venue_staff"]}><ManagerVenueForm /></ProtectedRoute>} />
              <Route path="/manager/venues/:venueId/courts" element={<ProtectedRoute allowedRoles={["court_manager", "venue_staff"]}><ManagerCourts /></ProtectedRoute>} />
              <Route path="/manager/venues/:venueId/courts/new" element={<ProtectedRoute allowedRoles={["court_manager", "venue_staff"]}><ManagerCourtForm /></ProtectedRoute>} />
              <Route path="/manager/venues/:venueId/courts/:courtId/edit" element={<ProtectedRoute allowedRoles={["court_manager", "venue_staff"]}><ManagerCourtForm /></ProtectedRoute>} />
              <Route path="/manager/courts" element={<ProtectedRoute allowedRoles={["court_manager", "venue_staff"]}><ManagerCourtsNew /></ProtectedRoute>} />
              <Route path="/manager/courts/new" element={<ProtectedRoute allowedRoles={["court_manager", "venue_staff"]}><ManagerCourtFormNew /></ProtectedRoute>} />
              <Route path="/manager/courts/:id/edit" element={<ProtectedRoute allowedRoles={["court_manager", "venue_staff"]}><ManagerCourtFormNew /></ProtectedRoute>} />
              <Route path="/manager/availability" element={<ProtectedRoute allowedRoles={["court_manager", "venue_staff"]}><ManagerAvailability /></ProtectedRoute>} />
              <Route path="/manager/equipment" element={<ProtectedRoute allowedRoles={["court_manager", "venue_staff"]}><ManagerEquipment /></ProtectedRoute>} />
              <Route path="/manager/bookings" element={<ProtectedRoute allowedRoles={["court_manager", "venue_staff"]}><ManagerBookings /></ProtectedRoute>} />
              <Route path="/manager/settings" element={<ProtectedRoute allowedRoles={["court_manager", "venue_staff"]}><ManagerSettings /></ProtectedRoute>} />
              {/* Admin Routes */}
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/sports" element={<AdminSportCategories />} />
              <Route path="/admin/surfaces" element={<AdminSurfaceTypes />} />
              <Route path="/admin/archiving" element={<AdminArchiving />} />
              <Route path="/admin/referrals" element={<AdminReferralSettings />} />
              <Route path="/admin/fees" element={<AdminPlatformFees />} />
              <Route path="/admin/finance" element={<AdminFinance />} />
              <Route path="/admin/venues" element={<AdminVenueSlugs />} />
              <Route path="/admin/*" element={<AdminDashboard />} />
              {/* Legal pages */}
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/cookies" element={<Cookies />} />
              {/* Public venue pages */}
              <Route path="/venue" element={<VenueDirectory />} />
              <Route path="/venue/:slug" element={<VenueLanding />} />
              {/* User Routes */}
              <Route path="/archived-sessions" element={<ArchivedSessions />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
