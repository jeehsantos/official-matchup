import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ManagerLayout } from "@/components/layout/ManagerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

const courtSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  capacity: z.number().min(1).max(100),
  hourly_rate: z.number().min(0),
  is_indoor: z.boolean(),
  is_active: z.boolean(),
  photo_url: z.string().url("Invalid URL").optional().or(z.literal("")),
  rules: z.string().optional(),
});

type CourtFormData = z.infer<typeof courtSchema>;

export default function ManagerCourtForm() {
  const { venueId, courtId } = useParams<{ venueId: string; courtId: string }>();
  const isEditing = courtId !== "new";
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation("manager");

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [venueAllowedSports, setVenueAllowedSports] = useState<string[]>([]);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<CourtFormData>({
    resolver: zodResolver(courtSchema),
    defaultValues: { capacity: 10, hourly_rate: 50, is_indoor: false, is_active: true, rules: "" },
  });

  useEffect(() => { if (isEditing && courtId) fetchCourt(); }, [courtId, isEditing]);
  useEffect(() => { if (venueId) fetchVenueAllowedSports(); }, [venueId]);

  const fetchVenueAllowedSports = async () => {
    if (!venueId) return;
    try {
      const { data, error } = await supabase.from("courts").select("allowed_sports").eq("venue_id", venueId).not("allowed_sports", "is", null);
      if (error) throw error;
      const uniqueSports = Array.from(new Set((data || []).flatMap((court: { allowed_sports: string[] | null }) => court.allowed_sports || [])));
      setVenueAllowedSports(uniqueSports);
    } catch (error) { console.error("Error fetching venue allowed sports:", error); setVenueAllowedSports([]); }
  };

  const fetchCourt = async () => {
    try {
      const { data, error } = await supabase.from("courts").select("*").eq("id", courtId).single();
      if (error) throw error;
      reset({ name: data.name, capacity: data.capacity, hourly_rate: Number(data.hourly_rate), is_indoor: data.is_indoor ?? false, is_active: data.is_active ?? true, photo_url: data.photo_url || "", rules: (data as any).rules || "" });
    } catch (error) { console.error("Error fetching court:", error); navigate(`/manager/venues/${venueId}/courts`); } finally { setLoading(false); }
  };

  const onSubmit = async (data: CourtFormData) => {
    if (!user || !venueId) return;
    setSubmitting(true);
    try {
      if (isEditing) {
        const { error } = await supabase.from("courts").update({ name: data.name, capacity: data.capacity, hourly_rate: data.hourly_rate, is_indoor: data.is_indoor, is_active: data.is_active, photo_url: data.photo_url || null, rules: data.rules || null } as any).eq("id", courtId);
        if (error) throw error;
        toast({ title: t("courtForm.courtUpdated") });
      } else {
        const { error } = await supabase.from("courts").insert({ venue_id: venueId, name: data.name, capacity: data.capacity, hourly_rate: data.hourly_rate, is_indoor: data.is_indoor, is_active: data.is_active, photo_url: data.photo_url || null, rules: data.rules || null, allowed_sports: venueAllowedSports } as any);
        if (error) throw error;
        toast({ title: t("courtForm.courtCreated") });
      }
      navigate(`/manager/venues/${venueId}/courts`);
    } catch (error: any) { toast({ title: "Error", description: error.message || "Failed to save court", variant: "destructive" }); } finally { setSubmitting(false); }
  };

  if (loading) {
    return (<ManagerLayout><div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></ManagerLayout>);
  }

  return (
    <ManagerLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-2xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="font-display text-2xl font-bold">{isEditing ? t("courtForm.editCourt") : t("courtForm.addCourt")}</h1>
            <p className="text-muted-foreground">{isEditing ? t("courtForm.updateCourtDetails") : t("courtForm.addNewCourt")}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader><CardTitle>{t("courtForm.courtDetails")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label htmlFor="name">{t("courtForm.courtName")} *</Label><Input id="name" {...register("name")} placeholder="e.g., Court 1, Main Arena" className="mt-1" />{errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}</div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="capacity">{t("courtForm.maxPlayers")} *</Label><Input id="capacity" type="number" {...register("capacity", { valueAsNumber: true })} className="mt-1" />{errors.capacity && <p className="text-sm text-destructive mt-1">{errors.capacity.message}</p>}</div>
                <div><Label htmlFor="hourly_rate">{t("courtForm.hourlyRate")} *</Label><Input id="hourly_rate" type="number" step="0.01" {...register("hourly_rate", { valueAsNumber: true })} className="mt-1" />{errors.hourly_rate && <p className="text-sm text-destructive mt-1">{errors.hourly_rate.message}</p>}</div>
              </div>
              <div><Label htmlFor="photo_url">{t("courtForm.photoUrl")}</Label><Input id="photo_url" {...register("photo_url")} placeholder="https://example.com/court-photo.jpg" className="mt-1" />{errors.photo_url && <p className="text-sm text-destructive mt-1">{errors.photo_url.message}</p>}</div>
              <div className="pt-4 border-t border-border">
                <div className="flex items-center gap-2 mb-2"><FileText className="h-4 w-4 text-muted-foreground" /><Label htmlFor="rules">{t("courtForm.courtRules")}</Label></div>
                <Textarea id="rules" {...register("rules")} placeholder="Enter any rules, restrictions, or guidelines for players booking this court..." rows={5} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-2">{t("courtForm.courtRulesHint")}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t("courtForm.settings")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div><Label htmlFor="is_indoor">{t("courtForm.indoorCourt")}</Label><p className="text-sm text-muted-foreground">{t("courtForm.indoorCourtDesc")}</p></div>
                <Switch id="is_indoor" checked={watch("is_indoor")} onCheckedChange={(checked) => setValue("is_indoor", checked)} />
              </div>
              <div className="flex items-center justify-between">
                <div><Label htmlFor="is_active">{t("courtForm.activeLabel")}</Label><p className="text-sm text-muted-foreground">{t("courtForm.activeDesc")}</p></div>
                <Switch id="is_active" checked={watch("is_active")} onCheckedChange={(checked) => setValue("is_active", checked)} />
              </div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("courtForm.saving")}</>) : (isEditing ? t("courtForm.updateCourt") : t("courtForm.createCourt"))}
          </Button>
        </form>
      </div>
    </ManagerLayout>
  );
}
