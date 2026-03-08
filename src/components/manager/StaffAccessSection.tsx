import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  UserPlus,
  Trash2,
  Users,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface StaffMember {
  id: string;
  user_id: string;
  created_at: string;
  profile?: {
    full_name: string | null;
    user_id: string;
  };
  email?: string;
}

interface StaffAccessSectionProps {
  venueId: string;
}

export function StaffAccessSection({ venueId }: StaffAccessSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
  });

  useEffect(() => {
    if (venueId) {
      fetchStaff();
    }
  }, [venueId]);

  const fetchStaff = async () => {
    if (!venueId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("venue_staff")
        .select("id, user_id, created_at")
        .eq("venue_id", venueId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles for each staff member
      if (data && data.length > 0) {
        const userIds = data.map((s) => s.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);

        const staffWithProfiles = data.map((s) => ({
          ...s,
          profile: profiles?.find((p) => p.user_id === s.user_id),
        }));
        setStaff(staffWithProfiles);
      } else {
        setStaff([]);
      }
    } catch (error) {
      console.error("Error fetching staff:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async () => {
    if (!formData.email || !formData.password || !formData.full_name) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setAdding(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-venue-staff", {
        body: {
          action: "add",
          venue_id: venueId,
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          full_name: formData.full_name.trim(),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Staff member added successfully" });
      setFormData({ full_name: "", email: "", password: "" });
      setShowPassword(false);
      fetchStaff();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add staff member",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveStaff = async (staffId: string) => {
    setRemovingId(staffId);
    try {
      const { data, error } = await supabase.functions.invoke("manage-venue-staff", {
        body: {
          action: "remove",
          staff_id: staffId,
          venue_id: venueId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Staff member removed" });
      fetchStaff();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove staff member",
        variant: "destructive",
      });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-left">
                <Users className="h-5 w-5" />
                <div>
                  <CardTitle>Staff Access</CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    Add staff members to manage availability, equipment and bookings
                  </CardDescription>
                </div>
              </div>
              {open ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
            {/* Add Staff Form */}
            <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/30">
              <h4 className="text-sm font-semibold">Add New Staff Member</h4>
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="staff_name">Full Name</Label>
                  <Input
                    id="staff_name"
                    value={formData.full_name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, full_name: e.target.value }))
                    }
                    placeholder="Staff member's full name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="staff_email">Email</Label>
                  <Input
                    id="staff_email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="staff@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="staff_password">Password</Label>
                  <div className="relative">
                    <Input
                      id="staff_password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, password: e.target.value }))
                      }
                      placeholder="Minimum 6 characters"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              <Button
                onClick={handleAddStaff}
                disabled={adding || !formData.email || !formData.password || !formData.full_name}
                className="w-full md:w-auto"
              >
                {adding ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Staff
                  </>
                )}
              </Button>
            </div>

            {/* Staff List */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Current Staff</h4>
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : staff.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No staff members added yet
                </p>
              ) : (
                <div className="space-y-2">
                  {staff.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 border border-border rounded-lg"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {member.profile?.full_name || "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Added {new Date(member.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                        onClick={() => handleRemoveStaff(member.id)}
                        disabled={removingId === member.id}
                      >
                        {removingId === member.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
