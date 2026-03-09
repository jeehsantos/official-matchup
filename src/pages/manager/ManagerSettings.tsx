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
  Loader2, CreditCard, CheckCircle2, AlertCircle, ExternalLink,
  Building2, User, Phone, Mail, Save, Shield, Eye, EyeOff,
  ChevronDown, ChevronUp, LogOut, Palette, Sun, Moon
} from "lucide-react";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation("manager");
  
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>("");
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  const [profileOpen, setProfileOpen] = useState(true);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  
  const [profileData, setProfileData] = useState<ProfileData>({
    full_name: "", phone: "", city: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  
  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: "", newPassword: "", confirmPassword: "",
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => { if (user) fetchProfile(); }, [user]);

  useEffect(() => {
    if (!venuesLoading) {
      const mapped = managerVenues.map(v => ({ id: v.id, name: v.name }));
      setVenues(mapped);
      if (mapped.length > 0 && !selectedVenueId) setSelectedVenueId(mapped[0].id);
      setLoading(false);
    }
  }, [managerVenues, venuesLoading]);

  useEffect(() => { checkConnectStatus(); }, [selectedVenueId, user]);

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast({ title: t("settings.stripeConnectedToast"), description: t("settings.stripeConnectedDesc") });
      checkConnectStatus();
    }
    if (searchParams.get("refresh") === "true") {
      toast({ title: t("settings.onboardingIncomplete"), description: t("settings.onboardingIncompleteDesc"), variant: "destructive" });
    }
  }, [searchParams]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase.from("profiles").select("full_name, phone, city").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      if (data) setProfileData({ full_name: data.full_name || "", phone: data.phone || "", city: data.city || "" });
    } catch (error) { console.error("Error fetching profile:", error); }
  };

  const checkConnectStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-status", { body: { venueId: selectedVenueId || null } });
      if (error) throw error;
      setConnectStatus(data);
    } catch (error) { console.error("Error checking connect status:", error); setConnectStatus(null); }
  };

  const handleConnectStripe = async () => {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-onboard", { body: { venueId: selectedVenueId || null, origin: window.location.origin } });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (error) {
      console.error("Error starting onboarding:", error);
      toast({ title: "Error", description: "Failed to start Stripe onboarding. Please try again.", variant: "destructive" });
    } finally { setActionLoading(false); }
  };

  const handleOpenDashboard = async () => {
    if (!selectedVenueId) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-dashboard", { body: { venueId: selectedVenueId } });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (error) {
      console.error("Error opening dashboard:", error);
      toast({ title: "Error", description: "Failed to open Stripe dashboard.", variant: "destructive" });
    } finally { setActionLoading(false); }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!profileData.full_name.trim()) {
      toast({ title: "Full name is required", variant: "destructive" });
      return;
    }
    if (!profileData.phone.trim()) {
      toast({ title: "Phone number is required", description: "Your phone number will be displayed on your venue's public page so players can contact you.", variant: "destructive" });
      return;
    }
    setSavingProfile(true);
    try {
      const { error } = await supabase.from("profiles").update({ full_name: profileData.full_name || null, phone: profileData.phone || null, city: profileData.city || null }).eq("user_id", user.id);
      if (error) throw error;
      // Sync phone and email to all venues owned by this manager
      const { error: venueError } = await supabase.from("venues").update({ phone: profileData.phone || null, email: user.email || null }).eq("owner_id", user.id);
      if (venueError) console.error("Error syncing venue contact:", venueError);
      toast({ title: t("settings.profileUpdated") });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update profile", variant: "destructive" });
    } finally { setSavingProfile(false); }
  };

  const handleChangePassword = async () => {
    if (!user?.email) return;
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast({ title: t("settings.missingFields"), description: t("settings.missingFieldsDesc"), variant: "destructive" });
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({ title: t("settings.passwordsDontMatch"), description: t("settings.passwordsDontMatchDesc"), variant: "destructive" });
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast({ title: t("settings.passwordTooShort"), description: t("settings.passwordTooShortDesc"), variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: passwordData.currentPassword });
      if (signInError) {
        toast({ title: t("settings.incorrectPassword"), description: t("settings.incorrectPasswordDesc"), variant: "destructive" });
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: passwordData.newPassword });
      if (updateError) throw updateError;
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast({ title: t("settings.passwordUpdated"), description: t("settings.passwordChanged") });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update password", variant: "destructive" });
    } finally { setSavingPassword(false); }
  };

  const handleSignOut = async () => { await signOut(); };

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
            <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
            <p className="text-muted-foreground text-sm md:text-base">{t("settings.subtitle")}</p>
          </div>
          <Button variant="outline" size="sm" className="lg:hidden" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            {t("settings.signOut")}
          </Button>
        </div>

        {/* Profile */}
        <Collapsible open={profileOpen} onOpenChange={setProfileOpen}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-left">
                    <User className="h-5 w-5" />
                    <div>
                      <CardTitle>{t("settings.profileInfo")}</CardTitle>
                      <CardDescription className="text-xs md:text-sm">{t("settings.yourContactInfo")}</CardDescription>
                    </div>
                  </div>
                  {profileOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">{t("settings.fullName")}</Label>
                    <Input id="full_name" value={profileData.full_name} onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))} placeholder={t("settings.fullNamePlaceholder")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">{t("settings.city")}</Label>
                    <Input id="city" value={profileData.city} onChange={(e) => setProfileData(prev => ({ ...prev, city: e.target.value }))} placeholder={t("settings.cityPlaceholder")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-2"><Phone className="h-4 w-4" />{t("settings.phoneNumber")} <span className="text-destructive">*</span></Label>
                    <Input id="phone" type="tel" value={profileData.phone} onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))} placeholder={t("settings.phonePlaceholder")} required />
                    <p className="text-xs text-muted-foreground">{t("settings.phoneHint")} This will be displayed on your venue's public page.</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><Mail className="h-4 w-4" />{t("settings.emailAddress")}</Label>
                    <Input value={user?.email || ""} disabled className="bg-muted" />
                    <p className="text-xs text-muted-foreground">{t("settings.emailHint")}</p>
                  </div>
                </div>
                <Button onClick={handleSaveProfile} disabled={savingProfile} className="w-full md:w-auto">
                  {savingProfile ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("settings.savingProfile")}</>) : (<><Save className="h-4 w-4 mr-2" />{t("settings.saveProfile")}</>)}
                </Button>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Security */}
        <Collapsible open={securityOpen} onOpenChange={setSecurityOpen}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-left">
                    <Shield className="h-5 w-5" />
                    <div>
                      <CardTitle>{t("settings.security")}</CardTitle>
                      <CardDescription className="text-xs md:text-sm">{t("settings.updatePassword")}</CardDescription>
                    </div>
                  </div>
                  {securityOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">{t("settings.currentPassword")}</Label>
                  <div className="relative">
                    <Input id="currentPassword" type={showCurrentPassword ? "text" : "password"} value={passwordData.currentPassword} onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))} placeholder={t("settings.currentPasswordPlaceholder")} className="pr-10" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowCurrentPassword(!showCurrentPassword)}>
                      {showCurrentPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">{t("settings.newPassword")}</Label>
                    <div className="relative">
                      <Input id="newPassword" type={showNewPassword ? "text" : "password"} value={passwordData.newPassword} onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))} placeholder={t("settings.newPasswordPlaceholder")} className="pr-10" />
                      <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowNewPassword(!showNewPassword)}>
                        {showNewPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">{t("settings.confirmPassword")}</Label>
                    <div className="relative">
                      <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} value={passwordData.confirmPassword} onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))} placeholder={t("settings.confirmPasswordPlaceholder")} className="pr-10" />
                      <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                        {showConfirmPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{t("settings.passwordMinLength")}</p>
                <Button onClick={handleChangePassword} disabled={savingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword} className="w-full md:w-auto">
                  {savingPassword ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("settings.updating")}</>) : (<><Shield className="h-4 w-4 mr-2" />{t("settings.updatePasswordBtn")}</>)}
                </Button>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Appearance */}
        <Collapsible open={appearanceOpen} onOpenChange={setAppearanceOpen}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-left">
                    <Palette className="h-5 w-5" />
                    <div>
                      <CardTitle>{t("settings.appearance")}</CardTitle>
                      <CardDescription className="text-xs md:text-sm">{t("settings.customizeLook")}</CardDescription>
                    </div>
                  </div>
                  {appearanceOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <Label>{t("settings.theme")}</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setTheme("light")} className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${theme === "light" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}>
                      <Sun className="h-5 w-5" />
                      <div className="text-left">
                        <p className="text-sm font-medium">{t("settings.light")}</p>
                        <p className="text-xs text-muted-foreground">{t("settings.lightDesc")}</p>
                      </div>
                    </button>
                    <button onClick={() => setTheme("dark")} className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${theme === "dark" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}>
                      <Moon className="h-5 w-5" />
                      <div className="text-left">
                        <p className="text-sm font-medium">{t("settings.dark")}</p>
                        <p className="text-xs text-muted-foreground">{t("settings.darkDesc")}</p>
                      </div>
                    </button>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Stripe Connect - Only for court_manager */}
        {userRole === "court_manager" && <Collapsible open={paymentOpen} onOpenChange={setPaymentOpen}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-left">
                    <CreditCard className="h-5 w-5" />
                    <div>
                      <CardTitle>{t("settings.paymentPayouts")}</CardTitle>
                      <CardDescription className="text-xs md:text-sm">{t("settings.connectStripeDesc")}</CardDescription>
                    </div>
                  </div>
                  {paymentOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
                {connectStatus?.connected ? (
                  <div className="space-y-4">
                    {connectStatus.details_submitted && connectStatus.charges_enabled && connectStatus.payouts_enabled ? (
                      <div className="p-3 md:p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center flex-shrink-0">
                            <CheckCircle2 className="h-5 w-5 md:h-6 md:w-6 text-green-600 dark:text-green-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm md:text-base text-green-800 dark:text-green-200">{t("settings.readyToReceive")}</p>
                            <p className="text-xs md:text-sm text-green-700 dark:text-green-300 mt-1">{t("settings.readyToReceiveDesc")}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <span className="font-medium text-sm md:text-base">{t("settings.stripeConnected")}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{t("settings.detailsSubmitted")}</span>
                        <Badge variant={connectStatus.details_submitted ? "default" : "secondary"}>{connectStatus.details_submitted ? t("settings.complete") : t("bookings.pending")}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{t("settings.payments")}</span>
                        <Badge variant={connectStatus.charges_enabled ? "default" : "secondary"}>{connectStatus.charges_enabled ? t("settings.enabled") : t("settings.disabled")}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{t("settings.payouts")}</span>
                        <Badge variant={connectStatus.payouts_enabled ? "default" : "secondary"}>{connectStatus.payouts_enabled ? t("settings.enabled") : t("settings.disabled")}</Badge>
                      </div>
                    </div>
                    {!connectStatus.details_submitted && (
                      <div className="p-3 md:p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-yellow-800 dark:text-yellow-200">{t("settings.completeSetup")}</p>
                          <p className="text-xs md:text-sm text-yellow-700 dark:text-yellow-300 mt-1">{t("settings.completeSetupDesc")}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-3">
                      {!connectStatus.details_submitted && (
                        <Button onClick={handleConnectStripe} disabled={actionLoading} className="w-full sm:w-auto">
                          {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          {t("settings.continueSetup")}
                        </Button>
                      )}
                      <Button variant={connectStatus.details_submitted ? "default" : "outline"} onClick={handleOpenDashboard} disabled={actionLoading} className="w-full sm:w-auto">
                        {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {t("settings.openStripeDashboard")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-3 md:p-4 bg-muted rounded-lg">
                      <h4 className="font-medium mb-2 text-sm md:text-base">{t("settings.whyConnectStripe")}</h4>
                      <ul className="text-xs md:text-sm text-muted-foreground space-y-1">
                        <li>• {t("settings.stripeReason1")}</li>
                        <li>• {t("settings.stripeReason2")}</li>
                        <li>• {t("settings.stripeReason3")}</li>
                      </ul>
                    </div>
                    <Button onClick={handleConnectStripe} disabled={actionLoading} className="w-full md:w-auto">
                      {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      <CreditCard className="h-4 w-4 mr-2" />
                      {t("settings.connectStripeAccount")}
                    </Button>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>}

        {userRole === "court_manager" && venues.length > 0 && (
          <StaffAccessSection venues={venues.map(v => ({ id: v.id, name: v.name }))} />
        )}

        {venues.length === 0 && userRole === "court_manager" && (
          <Card>
            <CardContent className="py-8 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">{t("settings.noVenuesYet")}</h3>
              <p className="text-muted-foreground text-sm">{t("settings.noVenuesDesc")}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </ManagerLayout>
  );
}
