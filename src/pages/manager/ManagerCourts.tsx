import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ManagerLayout } from "@/components/layout/ManagerLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SportIcon } from "@/components/ui/sport-icon";
import { ArrowLeft, Plus, Edit, Trash2, Users, DollarSign, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { useTranslation } from "react-i18next";

type Court = Database["public"]["Tables"]["courts"]["Row"];
type Venue = Database["public"]["Tables"]["venues"]["Row"];

export default function ManagerCourts() {
  const { venueId } = useParams<{ venueId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation("manager");

  const [venue, setVenue] = useState<Venue | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (venueId && user) fetchData(); }, [venueId, user]);

  const fetchData = async () => {
    try {
      const { data: venueData, error: venueError } = await supabase.from("venues").select("*").eq("id", venueId).eq("owner_id", user?.id).single();
      if (venueError) throw venueError;
      setVenue(venueData);
      const { data: courtsData, error: courtsError } = await supabase.from("courts").select("*").eq("venue_id", venueId).order("name");
      if (courtsError) throw courtsError;
      setCourts(courtsData || []);
    } catch (error) { console.error("Error fetching data:", error); navigate("/manager/venues"); } finally { setLoading(false); }
  };

  const handleDeleteCourt = async (courtId: string) => {
    if (!confirm(t("courts.deleteConfirm"))) return;
    try {
      const { error } = await supabase.from("courts").delete().eq("id", courtId);
      if (error) throw error;
      toast({ title: t("courts.courtDeleted") });
      setCourts(courts.filter(c => c.id !== courtId));
    } catch (error: any) { toast({ title: "Error", description: error.message || "Failed to delete court", variant: "destructive" }); }
  };

  if (loading) {
    return (<ManagerLayout><div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></ManagerLayout>);
  }

  return (
    <ManagerLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/manager/venues")}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold">{venue?.name}</h1>
            <p className="text-muted-foreground">{t("courts.manageCourtsAt")}</p>
          </div>
          <Link to={`/manager/venues/${venueId}/courts/new`}><Button className="gap-2"><Plus className="h-4 w-4" />{t("courts.addCourt")}</Button></Link>
        </div>

        {courts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">🏟️</div>
              <h3 className="font-semibold text-lg mb-2">{t("courts.noCourtsYet")}</h3>
              <p className="text-muted-foreground mb-4">{t("courts.noCourtsDesc")}</p>
              <Link to={`/manager/venues/${venueId}/courts/new`}><Button>{t("courts.addFirstCourt")}</Button></Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courts.map((court) => (
              <Card key={court.id}>
                <div className="aspect-video bg-muted relative">
                  {court.photo_url ? (
                    <img src={court.photo_url} alt={court.name} className="w-full h-full object-cover rounded-t-lg" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center rounded-t-lg">
                      <SportIcon sport={court.allowed_sports?.[0] || "other"} className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <Badge className="absolute top-2 left-2 capitalize">{court.allowed_sports?.join(", ") || "Other"}</Badge>
                  {!court.is_active && <Badge variant="secondary" className="absolute top-2 right-2">Inactive</Badge>}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">{court.name}</h3>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <span className="flex items-center gap-1"><Users className="h-4 w-4" />{court.capacity}</span>
                    <span className="flex items-center gap-1"><DollarSign className="h-4 w-4" />${court.hourly_rate}/hr</span>
                    <span>{court.is_indoor ? t("courts.indoor") : t("courts.outdoor")}</span>
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/manager/venues/${venueId}/courts/${court.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1"><Edit className="h-3 w-3" />{t("venues.edit")}</Button>
                    </Link>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteCourt(court.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}
