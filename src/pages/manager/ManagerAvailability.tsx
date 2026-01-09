import { useState, useEffect } from "react";
import { ManagerLayout } from "@/components/layout/ManagerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { SportIcon } from "@/components/ui/sport-icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Calendar as CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Database } from "@/integrations/supabase/types";
import { WeeklyScheduleEditor } from "@/components/manager/WeeklyScheduleEditor";
import { DateOverridesEditor } from "@/components/manager/DateOverridesEditor";
import { AvailabilityPreview } from "@/components/manager/AvailabilityPreview";
import { VenueConfigEditor } from "@/components/manager/VenueConfigEditor";

type Court = Database["public"]["Tables"]["courts"]["Row"];
type Venue = Database["public"]["Tables"]["venues"]["Row"];

interface CourtWithVenue extends Court {
  venues: Venue;
}

export default function ManagerAvailability() {
  const { user } = useAuth();
  const [courts, setCourts] = useState<CourtWithVenue[]>([]);
  const [selectedCourt, setSelectedCourt] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (user) {
      fetchCourts();
    }
  }, [user]);

  const fetchCourts = async () => {
    try {
      const { data: venues } = await supabase
        .from("venues")
        .select("id")
        .eq("owner_id", user?.id);

      if (venues && venues.length > 0) {
        const venueIds = venues.map(v => v.id);
        
        const { data: courtsData } = await supabase
          .from("courts")
          .select(`*, venues (*)`)
          .in("venue_id", venueIds)
          .eq("is_active", true);

        setCourts(courtsData as CourtWithVenue[] || []);
        if (courtsData && courtsData.length > 0) {
          setSelectedCourt(courtsData[0].id);
        }
      }
    } catch (error) {
      console.error("Error fetching courts:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectedCourtData = courts.find(c => c.id === selectedCourt);
  const venueId = selectedCourtData?.venue_id;

  const handleRefresh = () => setRefreshTrigger(prev => prev + 1);

  if (loading) {
    return (
      <ManagerLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Availability</h1>
          <p className="text-muted-foreground">Configure your venue's opening hours and exceptions</p>
        </div>

        {courts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">No courts available</h3>
              <p className="text-muted-foreground">Add courts first to configure availability.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="pt-6">
                <Select value={selectedCourt} onValueChange={setSelectedCourt}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a court" />
                  </SelectTrigger>
                  <SelectContent>
                    {courts.map((court) => (
                      <SelectItem key={court.id} value={court.id}>
                        <div className="flex items-center gap-2">
                          <SportIcon sport={court.sport_type} className="h-4 w-4" />
                          <span>{court.name}</span>
                          <span className="text-muted-foreground">- {court.venues.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {venueId && (
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                  <WeeklyScheduleEditor venueId={venueId} onScheduleUpdated={handleRefresh} />
                  <VenueConfigEditor venueId={venueId} onConfigUpdated={handleRefresh} />
                </div>
                <div className="space-y-6">
                  <DateOverridesEditor venueId={venueId} onOverridesUpdated={handleRefresh} />
                  <AvailabilityPreview venueId={venueId} courtId={selectedCourt} refreshTrigger={refreshTrigger} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </ManagerLayout>
  );
}
