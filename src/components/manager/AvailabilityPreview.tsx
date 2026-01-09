import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, Clock, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface AvailableSlot {
  start_time: string;
  available_durations: number[];
}

interface AvailabilityData {
  available: boolean;
  reason?: string;
  window?: {
    start_time: string;
    end_time: string;
  };
  slot_interval_minutes?: number;
  max_booking_minutes?: number;
  slots?: AvailableSlot[];
}

interface AvailabilityPreviewProps {
  venueId: string;
  courtId?: string;
  refreshTrigger?: number;
}

export function AvailabilityPreview({ venueId, courtId, refreshTrigger }: AvailabilityPreviewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);

  useEffect(() => {
    if (selectedDate) {
      fetchAvailability();
    }
  }, [selectedDate, venueId, courtId, refreshTrigger]);

  const fetchAvailability = async () => {
    if (!selectedDate) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-availability", {
        body: {
          venueId,
          courtId,
          date: format(selectedDate, "yyyy-MM-dd"),
        },
      });

      if (error) throw error;
      setAvailability(data);
    } catch (error) {
      console.error("Error fetching availability:", error);
      setAvailability(null);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    const hours = minutes / 60;
    return hours === 1 ? "1hr" : `${hours}hrs`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Live Preview
        </CardTitle>
        <CardDescription>
          See exactly what customers will see when booking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          disabled={(date) => date < new Date()}
          className="rounded-md border"
        />

        {selectedDate && (
          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">
                {format(selectedDate, "EEEE, MMMM d")}
              </h4>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>

            {!loading && availability && (
              <>
                {!availability.available ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <XCircle className="h-4 w-4" />
                    <span>Venue closed</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>
                        Open {availability.window?.start_time?.slice(0, 5)} - {availability.window?.end_time?.slice(0, 5)}
                      </span>
                    </div>

                    {availability.slots && availability.slots.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          {availability.slots.length} available time slots
                        </p>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                          {availability.slots.slice(0, 12).map((slot, idx) => (
                            <div
                              key={idx}
                              className="p-2 rounded-md border bg-card text-center"
                            >
                              <div className="font-medium text-sm">
                                {slot.start_time.slice(0, 5)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {slot.available_durations.map(d => formatDuration(d)).join(", ")}
                              </div>
                            </div>
                          ))}
                        </div>
                        {availability.slots.length > 12 && (
                          <p className="text-xs text-muted-foreground text-center">
                            +{availability.slots.length - 12} more slots
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        <Badge variant="secondary">Fully booked</Badge>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2 text-xs text-muted-foreground">
                      <Badge variant="outline">
                        {availability.slot_interval_minutes}min slots
                      </Badge>
                      <Badge variant="outline">
                        Max {availability.max_booking_minutes}min
                      </Badge>
                    </div>
                  </div>
                )}
              </>
            )}

            {!loading && !availability && (
              <p className="text-sm text-muted-foreground">
                No weekly schedule configured. Set up your hours above.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
