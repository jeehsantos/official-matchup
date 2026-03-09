import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, UserPlus, Trash2, Users, ChevronDown, ChevronUp, Eye, EyeOff, Building2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

interface StaffMember { id: string; user_id: string; venue_id: string; created_at: string; profile?: { full_name: string | null; user_id: string }; }
interface StaffWithVenues { user_id: string; full_name: string; venues: { staff_id: string; venue_id: string; venue_name: string }[]; created_at: string; }
interface VenueOption { id: string; name: string; }
interface StaffAccessSectionProps { venues: VenueOption[]; }

export function StaffAccessSection({ venues }: StaffAccessSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation("manager");
  const [open, setOpen] = useState(false);
  const [staffList, setStaffList] = useState<StaffWithVenues[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ full_name: "", email: "", password: "" });
  const [selectedVenueIds, setSelectedVenueIds] = useState<string[]>([]);

  useEffect(() => { if (venues.length > 0) fetchStaff(); }, [venues]);

  const fetchStaff = async () => {
    if (venues.length === 0) return;
    setLoading(true);
    try {
      const venueIds = venues.map((v) => v.id);
      const { data, error } = await supabase.from("venue_staff").select("id, user_id, venue_id, created_at").in("venue_id", venueIds).order("created_at", { ascending: false });
      if (error) throw error;
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((s) => s.user_id))];
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
        const grouped = new Map<string, StaffWithVenues>();
        for (const row of data) {
          const profile = profiles?.find((p) => p.user_id === row.user_id);
          const venueName = venues.find((v) => v.id === row.venue_id)?.name || "Unknown";
          if (!grouped.has(row.user_id)) grouped.set(row.user_id, { user_id: row.user_id, full_name: profile?.full_name || "Unknown", venues: [], created_at: row.created_at });
          grouped.get(row.user_id)!.venues.push({ staff_id: row.id, venue_id: row.venue_id, venue_name: venueName });
        }
        setStaffList(Array.from(grouped.values()));
      } else { setStaffList([]); }
    } catch (error) { console.error("Error fetching staff:", error); } finally { setLoading(false); }
  };

  const toggleVenue = (venueId: string) => setSelectedVenueIds((prev) => prev.includes(venueId) ? prev.filter((id) => id !== venueId) : [...prev, venueId]);
  const selectAllVenues = () => { if (selectedVenueIds.length === venues.length) setSelectedVenueIds([]); else setSelectedVenueIds(venues.map((v) => v.id)); };

  const handleAddStaff = async () => {
    if (!formData.email || !formData.password || !formData.full_name) { toast({ title: t("staff.missingFields"), description: t("staff.missingFieldsDesc"), variant: "destructive" }); return; }
    if (selectedVenueIds.length === 0) { toast({ title: t("staff.noVenuesSelected"), description: t("staff.noVenuesSelectedDesc"), variant: "destructive" }); return; }
    if (formData.password.length < 6) { toast({ title: t("staff.passwordTooShort"), description: t("staff.passwordTooShortDesc"), variant: "destructive" }); return; }
    setAdding(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-venue-staff", { body: { action: "add", venue_ids: selectedVenueIds, email: formData.email.trim().toLowerCase(), password: formData.password, full_name: formData.full_name.trim() } });
      if (data?.error) { toast({ title: "Cannot add staff", description: data.error, variant: "destructive" }); return; }
      if (error) throw error;
      toast({ title: t("staff.staffAdded") });
      setFormData({ full_name: "", email: "", password: "" });
      setSelectedVenueIds([]);
      setShowPassword(false);
      fetchStaff();
    } catch (error: any) { toast({ title: "Error", description: error.message || "Failed to add staff member", variant: "destructive" }); } finally { setAdding(false); }
  };

  const handleRemoveStaff = async (userId: string) => {
    const staffEntries = staffList.find((s) => s.user_id === userId)?.venues || [];
    if (staffEntries.length === 0) return;
    setRemovingId(userId);
    try {
      const staffIds = staffEntries.map((e) => e.staff_id);
      const { data, error } = await supabase.functions.invoke("manage-venue-staff", { body: { action: "remove", staff_ids: staffIds, venue_ids: staffEntries.map((e) => e.venue_id) } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: t("staff.staffRemoved") });
      fetchStaff();
    } catch (error: any) { toast({ title: "Error", description: error.message || "Failed to remove staff member", variant: "destructive" }); } finally { setRemovingId(null); }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-left">
                <Users className="h-5 w-5" />
                <div><CardTitle>{t("staff.title")}</CardTitle><CardDescription className="text-xs md:text-sm">{t("staff.subtitle")}</CardDescription></div>
              </div>
              {open ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
            <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/30">
              <h4 className="text-sm font-semibold">{t("staff.addNewStaff")}</h4>
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1.5"><Label htmlFor="staff_name">{t("staff.fullName")}</Label><Input id="staff_name" value={formData.full_name} onChange={(e) => setFormData((prev) => ({ ...prev, full_name: e.target.value }))} placeholder={t("staff.fullNamePlaceholder")} /></div>
                <div className="space-y-1.5"><Label htmlFor="staff_email">{t("staff.email")}</Label><Input id="staff_email" type="email" value={formData.email} onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))} placeholder={t("staff.emailPlaceholder")} /></div>
                <div className="space-y-1.5">
                  <Label htmlFor="staff_password">{t("staff.password")}</Label>
                  <div className="relative">
                    <Input id="staff_password" type={showPassword ? "text" : "password"} value={formData.password} onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))} placeholder={t("staff.passwordPlaceholder")} className="pr-10" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2"><Building2 className="h-4 w-4" />{t("staff.assignToVenues")}</Label>
                    {venues.length > 1 && <Button type="button" variant="ghost" size="sm" className="text-xs h-auto py-1 px-2" onClick={selectAllVenues}>{selectedVenueIds.length === venues.length ? t("staff.deselectAll") : t("staff.selectAll")}</Button>}
                  </div>
                  <div className="space-y-2 p-3 border border-border rounded-md bg-background">
                    {venues.map((venue) => (
                      <div key={venue.id} className="flex items-center gap-2">
                        <Checkbox id={`venue-${venue.id}`} checked={selectedVenueIds.includes(venue.id)} onCheckedChange={() => toggleVenue(venue.id)} />
                        <label htmlFor={`venue-${venue.id}`} className="text-sm cursor-pointer flex-1">{venue.name}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <Button onClick={handleAddStaff} disabled={adding || !formData.email || !formData.password || !formData.full_name || selectedVenueIds.length === 0} className="w-full md:w-auto">
                {adding ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("staff.adding")}</>) : (<><UserPlus className="h-4 w-4 mr-2" />{t("staff.addStaff")}</>)}
              </Button>
            </div>
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">{t("staff.currentStaff")}</h4>
              {loading ? (
                <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : staffList.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">{t("staff.noStaffYet")}</p>
              ) : (
                <div className="space-y-2">
                  {staffList.map((member) => (
                    <div key={member.user_id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{member.full_name}</p>
                        <div className="flex flex-wrap gap-1 mt-1">{member.venues.map((v) => (<Badge key={v.staff_id} variant="secondary" className="text-xs">{v.venue_name}</Badge>))}</div>
                        <p className="text-xs text-muted-foreground mt-1">{t("staff.added")} {new Date(member.created_at).toLocaleDateString()}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0" onClick={() => handleRemoveStaff(member.user_id)} disabled={removingId === member.user_id}>
                        {removingId === member.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
