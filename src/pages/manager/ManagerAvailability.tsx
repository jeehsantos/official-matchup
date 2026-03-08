import { useState, useEffect, useMemo } from "react";
import { ManagerLayout } from "@/components/layout/ManagerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { SportIcon } from "@/components/ui/sport-icon";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Calendar as CalendarIcon, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Database } from "@/integrations/supabase/types";
import { WeeklyScheduleEditor } from "@/components/manager/WeeklyScheduleEditor";
import { DateOverridesEditor } from "@/components/manager/DateOverridesEditor";
import { AvailabilityPreview } from "@/components/manager/AvailabilityPreview";
import { VenueConfigEditor } from "@/components/manager/VenueConfigEditor";
import { useManagerStripeReady } from "@/hooks/useStripeConnectStatus";
import { StripeSetupAlert } from "@/components/manager/StripeSetupAlert";
import { useManagerVenues } from "@/hooks/useManagerVenues";

type Court = Database["public"]["Tables"]["courts"]["Row"];
type Venue = Database["public"]["Tables"]["venues"]["Row"];

interface CourtWithVenue extends Court {
  venues: Venue;
}

// Group courts by venue for hierarchical display
interface GroupedCourts {
  [venueId: string]: {
    venue: Venue;
    courts: CourtWithVenue[];
  };
}

export default function ManagerAvailability() {
  const { user, userRole } = useAuth();
  const [courts, setCourts] = useState<CourtWithVenue[]>([]);
  const [selectedCourt, setSelectedCourt] = useState<string>("");
  const [courtsLoading, setCourtsLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { data: stripeStatus, isLoading: stripeLoading } = useManagerStripeReady();
  const { data: venues = [], isLoading: venuesLoading } = useManagerVenues();
  const isStaff = userRole === "venue_staff";

  useEffect(() => {
    if (venues.length > 0) {
      fetchCourts(venues.map(v => v.id));
    } else if (!venuesLoading) {
      setCourts([]);
    }
  }, [venues, venuesLoading]);

  const fetchCourts = async (venueIds: string[]) => {
    setCourtsLoading(true);
    try {
      const { data: courtsData } = await supabase
        .from("courts")
        .select(`*, venues (*)`)
        .in("venue_id", venueIds)
        .eq("is_active", true);

      setCourts(courtsData as CourtWithVenue[] || []);
      if (courtsData && courtsData.length > 0) {
        setSelectedCourt(courtsData[0].id);
      }
    } catch (error) {
      console.error("Error fetching courts:", error);
    } finally {
      setCourtsLoading(false);
    }
  };

  const selectedCourtData = courts.find(c => c.id === selectedCourt);
  const venueId = selectedCourtData?.venue_id;

  // Group courts by venue for hierarchical dropdown
  const groupedCourts = useMemo<GroupedCourts>(() => {
    return courts.reduce((acc, court) => {
      const venueId = court.venue_id;
      if (!acc[venueId]) {
        acc[venueId] = {
          venue: court.venues,
          courts: [],
        };
      }
      // Sort: parent courts first, then sub-courts
      if (court.parent_court_id) {
        acc[venueId].courts.push(court);
      } else {
        acc[venueId].courts.unshift(court);
      }
      return acc;
    }, {} as GroupedCourts);
  }, [courts]);

  const handleRefresh = () => setRefreshTrigger(prev => prev + 1);

  if (venuesLoading || courtsLoading) {
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
      <div className="manager-availability-mobile p-4 md:p-6 space-y-5 md:space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Availability</h1>
          <p className="text-muted-foreground">Configure your venue's opening hours and exceptions</p>
        </div>

        {!isStaff && !stripeLoading && !stripeStatus?.isReady && (
          <StripeSetupAlert hasVenues={stripeStatus?.hasVenues ?? false} />
        )}

        {courts.length === 0 ? (
          <Card className="border-border/40 md:border-border bg-transparent md:bg-card shadow-none md:shadow-sm">
            <CardContent className="py-12 text-center">
              <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">No courts available</h3>
              <p className="text-muted-foreground">Add courts first to configure availability.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-border/40 md:border-border bg-transparent md:bg-card shadow-none md:shadow-sm">
              <CardContent className="pt-5 md:pt-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Select Venue & Court
                  </label>
                  <Select value={selectedCourt} onValueChange={setSelectedCourt}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a venue and court" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {Object.entries(groupedCourts).map(([venueId, { venue, courts: venueCourts }]) => (
                        <SelectGroup key={venueId}>
                          <SelectLabel className="flex items-center gap-2 font-semibold text-foreground py-2 px-2 bg-muted/50">
                            <Building2 className="h-4 w-4 text-primary" />
                            <span>{venue.name}</span>
                            <span className="text-xs text-muted-foreground font-normal ml-auto">
                              {venueCourts.length} court{venueCourts.length !== 1 ? 's' : ''}
                            </span>
                          </SelectLabel>
                          {venueCourts.map((court) => (
                            <SelectItem 
                              key={court.id} 
                              value={court.id}
                              className="pl-6"
                            >
                              <div className="flex items-center gap-2">
                                <SportIcon sport={court.allowed_sports?.[0] || "other"} className="h-4 w-4" />
                                <span>{court.name}</span>
                                {court.parent_court_id && (
                                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                    sub-court
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {venueId && (
              <div className="grid lg:grid-cols-2 gap-5 md:gap-6">
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
