import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth-context";
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
import ArchivedSessions from "./pages/ArchivedSessions";

const queryClient = new QueryClient({});

const App = () => (
  <QueryClientProvider client={queryClient}>
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
            <Route path="/discover" element={<Discover />} />
            <Route path="/quick-games/:id" element={<QuickGameLobby />} />
            <Route path="/games" element={<Games />} />
            <Route path="/games/:id" element={<GameDetail />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/edit" element={<ProfileEdit />} />
            <Route path="/courts" element={<Courts />} />
            <Route path="/courts/:id" element={<CourtDetail />} />
            <Route path="/payment-success" element={<PaymentSuccess />} />
            {/* Manager Routes */}
            <Route path="/manager" element={<ManagerDashboard />} />
            <Route path="/manager/venues" element={<ManagerVenues />} />
            <Route path="/manager/venues/new" element={<ManagerVenueForm />} />
            <Route path="/manager/venues/:venueId/edit" element={<ManagerVenueForm />} />
            <Route path="/manager/venues/:venueId/courts" element={<ManagerCourts />} />
            <Route path="/manager/venues/:venueId/courts/new" element={<ManagerCourtForm />} />
            <Route path="/manager/venues/:venueId/courts/:courtId/edit" element={<ManagerCourtForm />} />
            <Route path="/manager/courts" element={<ManagerCourtsNew />} />
            <Route path="/manager/courts/new" element={<ManagerCourtFormNew />} />
            <Route path="/manager/courts/:id/edit" element={<ManagerCourtFormNew />} />
            <Route path="/manager/availability" element={<ManagerAvailability />} />
            <Route path="/manager/equipment" element={<ManagerEquipment />} />
            <Route path="/manager/bookings" element={<ManagerBookings />} />
            <Route path="/manager/settings" element={<ManagerSettings />} />
            {/* Admin Routes */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/sports" element={<AdminSportCategories />} />
            <Route path="/admin/surfaces" element={<AdminSurfaceTypes />} />
            <Route path="/admin/archiving" element={<AdminArchiving />} />
            <Route path="/admin/referrals" element={<AdminReferralSettings />} />
            <Route path="/admin/*" element={<AdminDashboard />} />
            {/* User Routes */}
            <Route path="/archived-sessions" element={<ArchivedSessions />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
