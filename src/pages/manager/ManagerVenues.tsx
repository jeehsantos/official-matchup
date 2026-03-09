import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ManagerLayout } from "@/components/layout/ManagerLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, MapPin, Edit, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Database } from "@/integrations/supabase/types";
import { useTranslation } from "react-i18next";

type Venue = Database["public"]["Tables"]["venues"]["Row"];

export default function ManagerVenues() {
  const { user } = useAuth();
  const { t } = useTranslation("manager");
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) fetchVenues(); }, [user]);

  const fetchVenues = async () => {
    try {
      const { data, error } = await supabase.from("venues").select("*").eq("owner_id", user?.id).order("created_at", { ascending: false });
      if (error) throw error;
      setVenues(data || []);
    } catch (error) { console.error("Error fetching venues:", error); } finally { setLoading(false); }
  };

  return (
    <ManagerLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">{t("venues.title")}</h1>
            <p className="text-muted-foreground">{t("venues.subtitle")}</p>
          </div>
          <Link to="/manager/venues/new"><Button className="gap-2"><Plus className="h-4 w-4" />{t("venues.addVenue")}</Button></Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : venues.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">{t("venues.noVenuesYet")}</h3>
              <p className="text-muted-foreground mb-4">{t("venues.noVenuesDesc")}</p>
              <Link to="/manager/venues/new"><Button>{t("venues.addFirstVenue")}</Button></Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {venues.map((venue) => (
              <Card key={venue.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex">
                    <div className="w-32 h-32 bg-muted shrink-0">
                      {venue.photo_url ? (
                        <img src={venue.photo_url} alt={venue.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Building2 className="h-8 w-8 text-muted-foreground" /></div>
                      )}
                    </div>
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold">{venue.name}</h3>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3 w-3" />{venue.city}</div>
                        </div>
                        <Badge variant={venue.is_active ? "default" : "secondary"}>{venue.is_active ? t("venues.active") : t("venues.inactive")}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1 mb-3">{venue.address}</p>
                      <div className="flex gap-2">
                        <Link to={`/manager/venues/${venue.id}/edit`}><Button variant="outline" size="sm" className="gap-1"><Edit className="h-3 w-3" />{t("venues.edit")}</Button></Link>
                        <Link to={`/manager/venues/${venue.id}/courts`}><Button size="sm" className="gap-1">{t("venues.manageCourts")}<ChevronRight className="h-3 w-3" /></Button></Link>
                      </div>
                    </div>
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
