import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { nzCities } from "@/data/nzLocations";
import { useToast } from "@/hooks/use-toast";
import { useSportCategories } from "@/hooks/useSportCategories";
import { useQueryClient } from "@tanstack/react-query";
import { NationalityCombobox } from "@/components/ui/nationality-combobox";
import {
  Loader2,
  ArrowLeft,
  Save,
} from "lucide-react";

interface ProfileData {
  full_name: string;
  phone: string;
  city: string;
  nationality_code: string;
  preferred_sports: string[];
  gender: string;
}

export default function ProfileEdit() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileExists, setProfileExists] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    full_name: "",
    phone: "",
    city: "",
    nationality_code: "",
    preferred_sports: [],
    gender: "",
  });
  
  // Fetch sports from database - NO FALLBACKS
  const { data: sportCategories = [], isLoading: loadingSports } = useSportCategories();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfileExists(true);
        setProfileData({
          full_name: data.full_name || "",
          phone: data.phone || "",
          city: data.city || "",
          nationality_code: data.nationality_code || "",
          preferred_sports: (data.preferred_sports as string[]) || [],
          gender: (data as any).gender || "",
        });
      } else {
        setProfileExists(false);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      if (profileExists) {
        // Update existing profile
        const { error } = await supabase
          .from("profiles")
          .update({
            full_name: profileData.full_name,
            phone: profileData.phone,
            city: profileData.city,
            nationality_code: profileData.nationality_code || null,
            preferred_sports: profileData.preferred_sports,
            gender: profileData.gender || null,
          } as any)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        // Insert new profile
        const { error } = await supabase
          .from("profiles")
          .insert({
            user_id: user.id,
            full_name: profileData.full_name,
            phone: profileData.phone,
            city: profileData.city,
            nationality_code: profileData.nationality_code || null,
            preferred_sports: profileData.preferred_sports,
            gender: profileData.gender || null,
          } as any);

        if (error) throw error;
      }

      await queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      toast({
        title: "Profile updated",
        description: "Your profile has been saved successfully.",
      });
      navigate("/profile");
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

  const toggleSport = (sportName: string) => {
    setProfileData((prev) => ({
      ...prev,
      preferred_sports: prev.preferred_sports.includes(sportName)
        ? prev.preferred_sports.filter((s) => s !== sportName)
        : [...prev.preferred_sports, sportName],
    }));
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <MobileLayout showHeader={false} showBottomNav={false}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="flex items-center justify-between p-4 max-w-2xl mx-auto">
            <Button variant="ghost" size="icon" onClick={() => navigate("/profile")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-display font-semibold">Edit Profile</h1>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Save className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-6 max-w-2xl mx-auto lg:p-6 pb-24">
          {/* Personal Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                <p className="text-xs text-muted-foreground">
                  This name will be shown to other players in games
                </p>
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

              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={profileData.gender}
                  onValueChange={(value) =>
                    setProfileData((prev) => ({ ...prev, gender: value }))
                  }
                >
                  <SelectTrigger id="gender" className="w-full">
                    <SelectValue placeholder="Select your gender" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Used for gender-specific game sessions
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Preferred Sports */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Preferred Sports</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          {/* Save Button */}
          <Button 
            className="w-full btn-athletic" 
            onClick={handleSave}
            disabled={saving}
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
    </MobileLayout>
  );
}
