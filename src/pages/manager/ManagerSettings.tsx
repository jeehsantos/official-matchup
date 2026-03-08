import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ManagerLayout } from "@/components/layout/ManagerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { StaffAccessSection } from "@/components/manager/StaffAccessSection";
import { useManagerVenues } from "@/hooks/useManagerVenues";
import { 
  Loader2, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  Building2,
  User,
  Phone,
  Mail,
  Save,
  Shield,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  LogOut,
  Palette,
  Sun,
  Moon
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";

interface ProfileData {
  full_name: string;
  phone: string;
  city: string;
}

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface Venue {
  id: string;
  name: string;
  stripe_account_id: string | null;
}

interface ConnectStatus {
  connected: boolean;
  details_submitted: boolean;
  payouts_enabled: boolean;
  charges_enabled: boolean;
  account_id?: string;
}

export default function ManagerSettings() {
  const { user, userRole, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: managerVenues = [], isLoading: venuesLoading } = useManagerVenues();
  
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>("");
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Collapsible states
  const [profileOpen, setProfileOpen] = useState(true);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  
  // Profile state
  const [profileData, setProfileData] = useState<ProfileData>({
    full_name: "",
    phone: "",
    city: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  
  // Password state - isolated from profile
  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  // Sync shared hook venues into local state
  useEffect(() => {
    if (!venuesLoading) {
      const mapped = managerVenues.map(v => ({
        id: v.id,
        name: v.name,
        stripe_account_id: v.stripe_account_id,
      }));
      setVenues(mapped);
      if (mapped.length > 0 && !selectedVenueId) {
        setSelectedVenueId(mapped[0].id);
      }
      setLoading(false);
    }
  }, [managerVenues, venuesLoading]);

  useEffect(() => {
    // Check Stripe status: use venue if available, otherwise user-level check
    checkConnectStatus();
  }, [selectedVenueId, user]);

  useEffect(() => {
    // Handle return from Stripe onboarding
    if (searchParams.get("success") === "true") {
      toast({
        title: "Stripe Connected!",
        description: "Your account has been connected successfully.",
      });
      checkConnectStatus();
    }
    if (searchParams.get("refresh") === "true") {
      toast({
        title: "Onboarding Incomplete",
        description: "Please complete the Stripe onboarding process.",
        variant: "destructive",
      });
    }
  }, [searchParams]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone, city")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setProfileData({
          full_name: data.full_name || "",
          phone: data.phone || "",
          city: data.city || "",
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  // fetchVenues removed — now using useManagerVenues hook

  const checkConnectStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-status", {
        body: { venueId: selectedVenueId || null },
      });

      if (error) throw error;
      setConnectStatus(data);
    } catch (error) {
      console.error("Error checking connect status:", error);
      setConnectStatus(null);
    }
  };

  const handleConnectStripe = async () => {

    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-onboard", {
        body: { 
          venueId: selectedVenueId || null,
          origin: window.location.origin,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error starting onboarding:", error);
      toast({
        title: "Error",
        description: "Failed to start Stripe onboarding. Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenDashboard = async () => {
    if (!selectedVenueId) return;

    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-dashboard", {
        body: { venueId: selectedVenueId },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Error opening dashboard:", error);
      toast({
        title: "Error",
        description: "Failed to open Stripe dashboard.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profileData.full_name || null,
          phone: profileData.phone || null,
          city: profileData.city || null,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({ title: "Profile updated successfully" });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user?.email) return;

    // Validation: Check if all fields are filled
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast({
        title: "Missing fields",
        description: "Please fill in all password fields",
        variant: "destructive",
      });
      return;
    }

    // Validation: Check if new passwords match
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "New password and confirm password must be identical",
        variant: "destructive",
      });
      return;
    }

    // Validation: Check password length
    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "New password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setSavingPassword(true);
    try {
      // Step 1: Verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordData.currentPassword,
      });

      if (signInError) {
        toast({
          title: "Incorrect current password",
          description: "Please check your current password and try again",
          variant: "destructive",
        });
        return;
      }

      // Step 2: Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (updateError) throw updateError;

      // Clear password fields on success
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      toast({ 
        title: "Password updated successfully",
        description: "Your password has been changed",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update password",
        variant: "destructive",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <ManagerLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-muted-foreground text-sm md:text-base">Manage your profile and payment settings</p>
          </div>
          {/* Mobile Sign Out Button */}
          <Button 
            variant="outline" 
            size="sm"
            className="lg:hidden"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>

        {/* Profile Settings Card - Collapsible */}
        <Collapsible open={profileOpen} onOpenChange={setProfileOpen}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-left">
                    <User className="h-5 w-5" />
                    <div>
                      <CardTitle>Profile Information</CardTitle>
                      <CardDescription className="text-xs md:text-sm">
                        Your contact information
                      </CardDescription>
                    </div>
                  </div>
                  {profileOpen ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input
                      id="full_name"
                      value={profileData.full_name}
                      onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))}
                      placeholder="Your full name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={profileData.city}
                      onChange={(e) => setProfileData(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="Your city"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+64 21 123 4567"
                    />
                    <p className="text-xs text-muted-foreground">
                      Displayed to players for court booking inquiries
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email Address
                    </Label>
                    <Input
                      value={user?.email || ""}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      Email is managed through your account settings
                    </p>
                  </div>
                </div>

                <Button onClick={handleSaveProfile} disabled={savingProfile} className="w-full md:w-auto">
                  {savingProfile ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Profile
                    </>
                  )}
                </Button>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Security / Password Reset Card - Collapsible */}
        <Collapsible open={securityOpen} onOpenChange={setSecurityOpen}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-left">
                    <Shield className="h-5 w-5" />
                    <div>
                      <CardTitle>Security</CardTitle>
                      <CardDescription className="text-xs md:text-sm">
                        Update your password
                      </CardDescription>
                    </div>
                  </div>
                  {securityOpen ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                      placeholder="Enter current password"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                        placeholder="Enter new password"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        placeholder="Confirm new password"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Password must be at least 6 characters long
                </p>

                <Button 
                  onClick={handleChangePassword} 
                  disabled={savingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                  className="w-full md:w-auto"
                >
                  {savingPassword ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      Update Password
                    </>
                  )}
                </Button>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Appearance / Theme Card */}
        <Collapsible open={appearanceOpen} onOpenChange={setAppearanceOpen}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-left">
                    <Palette className="h-5 w-5" />
                    <div>
                      <CardTitle>Appearance</CardTitle>
                      <CardDescription className="text-xs md:text-sm">
                        Customize the look and feel
                      </CardDescription>
                    </div>
                  </div>
                  {appearanceOpen ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <Label>Theme</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setTheme("light")}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
                        theme === "light"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <Sun className="h-5 w-5" />
                      <div className="text-left">
                        <p className="text-sm font-medium">Light</p>
                        <p className="text-xs text-muted-foreground">Bright appearance</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setTheme("dark")}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
                        theme === "dark"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <Moon className="h-5 w-5" />
                      <div className="text-left">
                        <p className="text-sm font-medium">Dark</p>
                        <p className="text-xs text-muted-foreground">Easier on the eyes</p>
                      </div>
                    </button>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Stripe Connect Card - Only for court_manager */}
        {userRole === "court_manager" && <Collapsible open={paymentOpen} onOpenChange={setPaymentOpen}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-left">
                    <CreditCard className="h-5 w-5" />
                    <div>
                      <CardTitle>Payment Payouts</CardTitle>
                      <CardDescription className="text-xs md:text-sm">
                        Connect Stripe to receive payments
                      </CardDescription>
                    </div>
                  </div>
                  {paymentOpen ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
                {/* Status Display */}
                {connectStatus?.connected ? (
                  <div className="space-y-4">
                    {/* Fully Connected Success State */}
                    {connectStatus.details_submitted && connectStatus.charges_enabled && connectStatus.payouts_enabled ? (
                      <div className="p-3 md:p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center flex-shrink-0">
                            <CheckCircle2 className="h-5 w-5 md:h-6 md:w-6 text-green-600 dark:text-green-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm md:text-base text-green-800 dark:text-green-200">
                              Ready to Receive Payments
                            </p>
                            <p className="text-xs md:text-sm text-green-700 dark:text-green-300 mt-1">
                              Your Stripe account is fully configured. Payments from bookings will be transferred to your bank account.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <span className="font-medium text-sm md:text-base">Stripe Account Connected</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Details Submitted:</span>
                        <Badge variant={connectStatus.details_submitted ? "default" : "secondary"}>
                          {connectStatus.details_submitted ? "Complete" : "Pending"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Payments:</span>
                        <Badge variant={connectStatus.charges_enabled ? "default" : "secondary"}>
                          {connectStatus.charges_enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Payouts:</span>
                        <Badge variant={connectStatus.payouts_enabled ? "default" : "secondary"}>
                          {connectStatus.payouts_enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                    </div>

                    {!connectStatus.details_submitted && (
                      <div className="p-3 md:p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-yellow-800 dark:text-yellow-200">
                            Complete Your Setup
                          </p>
                          <p className="text-xs md:text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                            Your Stripe account setup is incomplete. Click below to continue.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3">
                      {!connectStatus.details_submitted && (
                        <Button onClick={handleConnectStripe} disabled={actionLoading} className="w-full sm:w-auto">
                          {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Continue Setup
                        </Button>
                      )}
                      <Button 
                        variant={connectStatus.details_submitted ? "default" : "outline"} 
                        onClick={handleOpenDashboard} 
                        disabled={actionLoading}
                        className="w-full sm:w-auto"
                      >
                        {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open Stripe Dashboard
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-3 md:p-4 bg-muted rounded-lg">
                      <h4 className="font-medium mb-2 text-sm md:text-base">Why connect Stripe?</h4>
                      <ul className="text-xs md:text-sm text-muted-foreground space-y-1">
                        <li>• Receive court booking payments directly to your bank</li>
                        <li>• Automatic payouts with transparent fee structure</li>
                        <li>• View earnings and manage payouts from Stripe dashboard</li>
                      </ul>
                    </div>

                    <Button onClick={handleConnectStripe} disabled={actionLoading} className="w-full md:w-auto">
                      {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      <CreditCard className="h-4 w-4 mr-2" />
                      Connect Stripe Account
                    </Button>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>}

        {/* Staff Access Section - Only for court_manager */}
        {userRole === "court_manager" && venues.length > 0 && (
          <StaffAccessSection venues={venues.map(v => ({ id: v.id, name: v.name }))} />
        )}

        {venues.length === 0 && userRole === "court_manager" && (
          <Card>
            <CardContent className="py-8 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No Venues Yet</h3>
              <p className="text-muted-foreground text-sm">
                Complete your Stripe account setup above first, then you'll be able to create venues and start accepting bookings.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </ManagerLayout>
  );
}
