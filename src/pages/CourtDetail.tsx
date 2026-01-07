import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { SportIcon } from "@/components/ui/sport-icon";
import { 
  ArrowLeft,
  MapPin, 
  Clock,
  Users,
  DollarSign,
  CheckCircle2,
  Loader2,
  CalendarDays
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { format, isSameDay } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type Court = Database["public"]["Tables"]["courts"]["Row"];
type Venue = Database["public"]["Tables"]["venues"]["Row"];
type Availability = Database["public"]["Tables"]["court_availability"]["Row"];

interface CourtWithVenue extends Court {
  venues: Venue | null;
}

export default function CourtDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [court, setCourt] = useState<CourtWithVenue | null>(null);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<Availability | null>(null);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    if (id) {
      fetchCourt();
      fetchAvailability();
    }
  }, [id]);

  const fetchCourt = async () => {
    try {
      const { data, error } = await supabase
        .from("courts")
        .select(`
          *,
          venues (*)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      setCourt(data as CourtWithVenue);
    } catch (error) {
      console.error("Error fetching court:", error);
      navigate("/courts");
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailability = async () => {
    try {
      const { data, error } = await supabase
        .from("court_availability")
        .select("*")
        .eq("court_id", id)
        .eq("is_booked", false)
        .gte("available_date", format(new Date(), "yyyy-MM-dd"))
        .order("available_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;
      setAvailability(data || []);
    } catch (error) {
      console.error("Error fetching availability:", error);
    }
  };

  const handleBookSlot = async () => {
    if (!user) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to book a court.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    if (!selectedSlot || !court) return;

    setBooking(true);
    try {
      // For now, we'll just mark the slot as booked
      // In a full implementation, this would create a session and handle payments
      const { error } = await supabase
        .from("court_availability")
        .update({ is_booked: true })
        .eq("id", selectedSlot.id);

      if (error) throw error;

      toast({
        title: "Booking confirmed!",
        description: `You've booked ${court.name} on ${format(new Date(selectedSlot.available_date), "MMMM d")} at ${selectedSlot.start_time}.`,
      });

      // Refresh availability
      fetchAvailability();
      setSelectedSlot(null);
    } catch (error) {
      toast({
        title: "Booking failed",
        description: "There was an error processing your booking. Please try again.",
        variant: "destructive",
      });
    } finally {
      setBooking(false);
    }
  };

  const slotsForSelectedDate = selectedDate
    ? availability.filter(slot => 
        isSameDay(new Date(slot.available_date), selectedDate)
      )
    : [];

  const datesWithAvailability = availability.map(slot => new Date(slot.available_date));

  if (loading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  if (!court) {
    return (
      <MobileLayout>
        <div className="p-4 text-center">
          <p>Court not found.</p>
          <Link to="/courts">
            <Button variant="link">Back to Courts</Button>
          </Link>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="pb-24">
        {/* Back Button */}
        <div className="p-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        {/* Hero Image */}
        <div className="aspect-video bg-muted relative">
          {court.photo_url ? (
            <img 
              src={court.photo_url} 
              alt={court.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <SportIcon sport={court.sport_type} className="h-16 w-16 text-muted-foreground" />
            </div>
          )}
          <Badge className="absolute top-4 left-4 capitalize">
            <SportIcon sport={court.sport_type} className="h-3 w-3 mr-1" />
            {court.sport_type}
          </Badge>
        </div>

        {/* Court Info */}
        <div className="p-4 space-y-6">
          <div>
            <h1 className="font-display text-2xl font-bold mb-2">{court.name}</h1>
            {court.venues && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{court.venues.name}</span>
                <span>•</span>
                <span>{court.venues.address}, {court.venues.city}</span>
              </div>
            )}
          </div>

          {/* Quick Info */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card rounded-xl p-4 border border-border text-center">
              <DollarSign className="h-5 w-5 mx-auto mb-2 text-primary" />
              <div className="font-semibold">${court.hourly_rate}</div>
              <div className="text-xs text-muted-foreground">per hour</div>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border text-center">
              <Users className="h-5 w-5 mx-auto mb-2 text-primary" />
              <div className="font-semibold">{court.capacity}</div>
              <div className="text-xs text-muted-foreground">max players</div>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border text-center">
              <div className="h-5 w-5 mx-auto mb-2 text-primary flex items-center justify-center">
                {court.is_indoor ? "🏢" : "🌳"}
              </div>
              <div className="font-semibold">{court.is_indoor ? "Indoor" : "Outdoor"}</div>
              <div className="text-xs text-muted-foreground">facility</div>
            </div>
          </div>

          {/* Venue Details */}
          {court.venues?.amenities && court.venues.amenities.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Amenities</h3>
              <div className="flex flex-wrap gap-2">
                {court.venues.amenities.map((amenity, i) => (
                  <Badge key={i} variant="secondary">{amenity}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Availability Calendar */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Select a Date
            </h3>
            <div className="bg-card rounded-xl border border-border p-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date < new Date() || !datesWithAvailability.some(d => isSameDay(d, date))}
                modifiers={{
                  available: datesWithAvailability,
                }}
                modifiersStyles={{
                  available: { backgroundColor: "hsl(var(--primary) / 0.1)" }
                }}
                className="mx-auto"
              />
            </div>
          </div>

          {/* Time Slots */}
          {selectedDate && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Available Times for {format(selectedDate, "MMMM d")}
              </h3>
              {slotsForSelectedDate.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No available slots for this date. Try another day.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {slotsForSelectedDate.map((slot) => (
                    <Button
                      key={slot.id}
                      variant={selectedSlot?.id === slot.id ? "default" : "outline"}
                      className="flex-col h-auto py-3"
                      onClick={() => setSelectedSlot(slot)}
                    >
                      <span className="font-semibold">{slot.start_time.slice(0, 5)}</span>
                      <span className="text-xs opacity-70">to {slot.end_time.slice(0, 5)}</span>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Booking Footer */}
        {selectedSlot && (
          <div className="fixed bottom-16 left-0 right-0 p-4 glass border-t border-border">
            <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
              <div>
                <div className="font-semibold">${court.hourly_rate}</div>
                <div className="text-sm text-muted-foreground">
                  {format(new Date(selectedSlot.available_date), "MMM d")} • {selectedSlot.start_time.slice(0, 5)}
                </div>
              </div>
              <Button onClick={handleBookSlot} disabled={booking} className="gap-2">
                {booking ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Booking...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Book Now
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
