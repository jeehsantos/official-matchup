import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Loader2,
  Settings,
  Shield,
  LogOut,
  ChevronDown,
  User,
  Moon,
  Sun,
  Save,
  Activity,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Archive,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { nzCities } from "@/data/nzLocations";
import { useToast } from "@/hooks/use-toast";
import { useSportCategories } from "@/hooks/useSportCategories";
import { useUserCredits } from "@/hooks/useUserCredits";
import { CreditsDisplay } from "@/components/profile/CreditsDisplay";
import { ReferralSection } from "@/components/profile/ReferralSection";
import { NationalityCombobox } from "@/components/ui/nationality-combobox";

interface ProfileData {
  full_name: string;
  phone: string;
  city: string;
  nationality_code: string;
  preferred_sports: string[];
}

export default function Profile() {
  const { user, isLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Fetch sports from database - NO FALLBACKS
  const { data: sportCategories = [], isLoading: loadingSports } = useSportCategories();
  
  // Fetch user credits
  const { balance: credits, loading: loadingCredits } = useUserCredits();

  // Profile stats
  const [gamesPlayed, setGamesPlayed] = useState<number>(0);
  const [groupCount, setGroupCount] = useState<number>(0);
  const [showRate, setShowRate] = useState<number>(100);
  
  // Password change state
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [profileData, setProfileData] = useState<ProfileData>({
    full_name: "",
    phone: "",
    city: "",
    nationality_code: "",
    preferred_sports: [],
  });
  const [originalData, setOriginalData] = useState<ProfileData>({
    full_name: "",
    phone: "",
    city: "",
    nationality_code: "",
    preferred_sports: [],
  });

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  // Track changes
  useEffect(() => {
    const changed = 
      profileData.full_name !== originalData.full_name ||
      profileData.phone !== originalData.phone ||
      profileData.city !== originalData.city ||
      profileData.nationality_code !== originalData.nationality_code ||
      JSON.stringify(profileData.preferred_sports) !== JSON.stringify(originalData.preferred_sports);
    setHasChanges(changed);
  }, [profileData, originalData]);

  const fetchProfile = async () => {
    if (!user) return;
    
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const profileValues = {
          full_name: data.full_name || "",
          phone: data.phone || "",
          city: data.city || "",
          nationality_code: data.nationality_code || "",
          preferred_sports: (data.preferred_sports as string[]) || [],
        };
        setProfileData(profileValues);
        setOriginalData(profileValues);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setProfileLoading(false);
    }
  };

  // Fetch profile stats
  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      const [sessionsResult, groupsResult, confirmedResult] = await Promise.all([
        supabase
          .from("session_players")
          .select("id, sessions!inner(session_date, is_cancelled)", { count: "exact" })
          .eq("user_id", user.id)
          .eq("sessions.is_cancelled", false)
          .lte("sessions.session_date", new Date().toISOString().split("T")[0]),
        supabase
          .from("group_members")
          .select("id", { count: "exact" })
          .eq("user_id", user.id),
        supabase
          .from("session_players")
          .select("id, sessions!inner(session_date, is_cancelled)", { count: "exact" })
          .eq("user_id", user.id)
          .eq("sessions.is_cancelled", false)
          .lte("sessions.session_date", new Date().toISOString().split("T")[0])
          .eq("is_confirmed", true),
      ]);

      const totalPast = sessionsResult.count ?? 0;
      const confirmedPast = confirmedResult.count ?? 0;

      setGamesPlayed(totalPast);
      setGroupCount(groupsResult.count ?? 0);
      setShowRate(totalPast > 0 ? Math.round((confirmedPast / totalPast) * 100) : 100);
    };
    fetchStats();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      // Use upsert to handle cases where profile might not exist
      const { error } = await supabase
        .from("profiles")
        .upsert({
          user_id: user.id,
          full_name: profileData.full_name,
          phone: profileData.phone,
          city: profileData.city,
          nationality_code: profileData.nationality_code || null,
          preferred_sports: profileData.preferred_sports,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;

      setOriginalData({ ...profileData });
      toast({
        title: "Profile updated",
        description: "Your profile has been saved successfully.",
      });
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({
        title: "Error",
        description: "Failed to save profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  // Password validation
  const validatePassword = (password: string): string[] => {
    const errors: string[] = [];
    if (password.length < 8) errors.push("At least 8 characters");
    if (!/[A-Z]/.test(password)) errors.push("One uppercase letter");
    if (!/[a-z]/.test(password)) errors.push("One lowercase letter");
    if (!/[0-9]/.test(password)) errors.push("One number");
    return errors;
  };

  const handlePasswordChange = (value: string) => {
    setPasswordData((prev) => ({ ...prev, newPassword: value }));
    setPasswordErrors(validatePassword(value));
  };

  const handleUpdatePassword = async () => {
    if (!user) return;
    
    // Validate passwords match
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are identical.",
        variant: "destructive",
      });
      return;
    }
    
    // Validate password strength
    const errors = validatePassword(passwordData.newPassword);
    if (errors.length > 0) {
      toast({
        title: "Password too weak",
        description: "Please meet all password requirements.",
        variant: "destructive",
      });
      return;
    }
    
    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });
      
      if (error) throw error;
      
      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });
      
      // Clear form
      setPasswordData({ newPassword: "", confirmPassword: "" });
      setPasswordErrors([]);
    } catch (error: any) {
      console.error("Error updating password:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const toggleSport = (sportName: string) => {
    setProfileData((prev) => ({
      ...prev,
      preferred_sports: prev.preferred_sports.includes(sportName)
        ? prev.preferred_sports.filter((s) => s !== sportName)
        : [...prev.preferred_sports, sportName],
    }));
  };

  if (isLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const userInitials = user.email?.charAt(0).toUpperCase() || "U";

  return (
    <MobileLayout>
      <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto lg:px-6 pb-32">
        {/* Profile header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user.user_metadata?.avatar_url} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xl font-display font-bold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="font-display font-bold text-lg truncate">
                  {profileData.full_name || user.user_metadata?.full_name || "Player"}
                </h2>
                <p className="text-muted-foreground text-sm truncate">
                  {user.email}
                </p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="secondary" className="text-xs">
                    Player
                  </Badge>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border">
              <div className="text-center">
                <p className="font-display font-bold text-xl">{gamesPlayed}</p>
                <p className="text-xs text-muted-foreground">Games Played</p>
              </div>
              <div className="text-center">
                <p className="font-display font-bold text-xl">{groupCount}</p>
                <p className="text-xs text-muted-foreground">Groups</p>
              </div>
              <div className="text-center">
                <p className="font-display font-bold text-xl">{showRate}%</p>
                <p className="text-xs text-muted-foreground">Show Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Credits Display */}
        <CreditsDisplay credits={credits} isLoading={loadingCredits} />

        {/* Referral Program */}
        <ReferralSection />

        {/* Collapsible Sections */}
        <Card>
          <CardContent className="p-0">
            {/* Personal Information */}
            <Collapsible 
              open={expandedSections.includes("personal")}
              onOpenChange={() => toggleSection("personal")}
            >
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors border-b border-border">
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-sm">Personal Information</p>
                    <p className="text-xs text-muted-foreground">
                      Name, phone, and location
                    </p>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${
                    expandedSections.includes("personal") ? 'rotate-180' : ''
                  }`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4 pt-2 space-y-4 border-b border-border">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    placeholder="Enter your first and last name"
                    value={profileData.full_name}
                    onChange={(e) =>
                      setProfileData((prev) => ({ ...prev, full_name: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={user.email || ""}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="Enter your phone number"
                    value={profileData.phone}
                    onChange={(e) =>
                      setProfileData((prev) => ({ ...prev, phone: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Select
                    value={profileData.city}
                    onValueChange={(value) =>
                      setProfileData((prev) => ({ ...prev, city: value }))
                    }
                  >
                    <SelectTrigger id="city" className="w-full">
                      <SelectValue placeholder="Select your city" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      {nzCities.map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nationality">Nationality</Label>
                  <NationalityCombobox
                    value={profileData.nationality_code}
                    onValueChange={(value) =>
                      setProfileData((prev) => ({ ...prev, nationality_code: value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Your flag will be shown to other players
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Preferred Sports */}
            <Collapsible 
              open={expandedSections.includes("sports")}
              onOpenChange={() => toggleSection("sports")}
            >
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors border-b border-border">
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                    <Activity className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-sm">Preferred Sports</p>
                    <p className="text-xs text-muted-foreground">
                      Sports you enjoy playing
                    </p>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${
                    expandedSections.includes("sports") ? 'rotate-180' : ''
                  }`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4 pt-2 border-b border-border">
                {loadingSports ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading sports...
                  </div>
                ) : sportCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">
                    No sports available. Please contact support.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {sportCategories.map((sport) => (
                      <Badge
                        key={sport.id}
                        variant={
                          profileData.preferred_sports.includes(sport.name)
                            ? "default"
                            : "outline"
                        }
                        className={`cursor-pointer px-3 py-1.5 text-sm transition-all ${
                          profileData.preferred_sports.includes(sport.name)
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        }`}
                        onClick={() => toggleSport(sport.name)}
                      >
                        <span className="mr-1.5">{sport.icon || "🎯"}</span>
                        {sport.display_name}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-3">
                  Select sports you enjoy playing
                </p>
              </CollapsibleContent>
            </Collapsible>

            {/* Archived Sessions - Simple Link */}
            <button 
              onClick={() => navigate("/archived-sessions")}
              className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors border-b border-border"
            >
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                <Archive className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-sm">Archived Sessions</p>
                <p className="text-xs text-muted-foreground">
                  View sessions older than 2 years
                </p>
              </div>
              <ChevronDown className="h-5 w-5 text-muted-foreground rotate-[-90deg]" />
            </button>

            {/* Privacy & Security */}
            <Collapsible 
              open={expandedSections.includes("privacy")}
              onOpenChange={() => toggleSection("privacy")}
            >
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors border-b border-border">
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-sm">Privacy & Security</p>
                    <p className="text-xs text-muted-foreground">
                      Account security settings
                    </p>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${
                    expandedSections.includes("privacy") ? 'rotate-180' : ''
                  }`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4 pt-2 space-y-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Key className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm font-medium">Change Password</span>
                  </div>
                </div>
                
                <div className="space-y-3 pl-8">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Enter new password"
                        value={passwordData.newPassword}
                        onChange={(e) => handlePasswordChange(e.target.value)}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    
                    {/* Password requirements */}
                    {passwordData.newPassword && (
                      <div className="text-xs space-y-1 mt-2">
                        {["At least 8 characters", "One uppercase letter", "One lowercase letter", "One number"].map((req) => {
                          const isMet = !passwordErrors.includes(req);
                          return (
                            <div key={req} className={`flex items-center gap-1.5 ${isMet ? 'text-primary' : 'text-muted-foreground'}`}>
                              {isMet ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                              {req}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm new password"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                      <p className="text-xs text-destructive">Passwords don't match</p>
                    )}
                  </div>
                  
                  <Button 
                    onClick={handleUpdatePassword} 
                    disabled={passwordLoading || passwordErrors.length > 0 || !passwordData.newPassword || passwordData.newPassword !== passwordData.confirmPassword}
                    size="sm"
                  >
                    {passwordLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Updating...
                      </>
                    ) : (
                      "Update Password"
                    )}
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* App Settings */}
            <Collapsible 
              open={expandedSections.includes("settings")}
              onOpenChange={() => toggleSection("settings")}
            >
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                    <Settings className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-sm">App Settings</p>
                    <p className="text-xs text-muted-foreground">
                      Theme and preferences
                    </p>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${
                    expandedSections.includes("settings") ? 'rotate-180' : ''
                  }`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4 pt-2 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {theme === 'dark' ? (
                      <Moon className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Sun className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">Dark Mode</p>
                      <p className="text-xs text-muted-foreground">
                        Toggle dark theme
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={theme === 'dark'}
                    onCheckedChange={toggleTheme}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        {/* Save Button - Fixed at bottom when has changes */}
        {hasChanges && (
          <div className="fixed bottom-20 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border z-50">
            <div className="max-w-2xl mx-auto">
              <Button 
                onClick={handleSave} 
                disabled={saving}
                className="w-full h-12"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Sign Out */}
        <Button
          variant="outline"
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </MobileLayout>
  );
}
