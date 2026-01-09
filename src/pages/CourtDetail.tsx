import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { PublicLayout } from "@/components/layout/PublicLayout";
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
  CalendarDays,
  LogIn,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { format, isSameDay, getDay } from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import { GroupSelectionModal } from "@/components/booking/GroupSelectionModal";

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
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showGallery, setShowGallery] = useState(false);

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

  const handleBookSlot = () => {
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

    // Open group selection modal
    setShowGroupModal(true);
  };

  const handleGroupConfirm = async (groupId: string, isNewGroup: boolean, paymentType: "single" | "split") => {
    if (!selectedSlot || !court || !user) return;

    setShowGroupModal(false);
    setBooking(true);

    try {
      // Create a session for this booking
      const slotDate = new Date(selectedSlot.available_date);
      const paymentDeadline = new Date(slotDate);
      paymentDeadline.setHours(paymentDeadline.getHours() - 24);

      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .insert({
          group_id: groupId,
          court_id: court.id,
          session_date: selectedSlot.available_date,
          start_time: selectedSlot.start_time,
          duration_minutes: 60, // Default 1 hour
          court_price: court.hourly_rate,
          min_players: 6,
          max_players: court.capacity,
          payment_deadline: paymentDeadline.toISOString(),
          state: "protected",
          payment_type: paymentType,
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Add the organizer as a session player automatically
      const { error: playerError } = await supabase
        .from("session_players")
        .insert({
          session_id: session.id,
          user_id: user.id,
          is_confirmed: true,
          confirmed_at: new Date().toISOString(),
        });

      if (playerError) {
        console.error("Error adding organizer as player:", playerError);
        // Don't throw - the booking should still succeed even if this fails
      }

      // Mark the slot as booked
      const { error: bookingError } = await supabase
        .from("court_availability")
        .update({
          is_booked: true,
          booked_by_user_id: user.id,
          booked_by_group_id: groupId,
          booked_by_session_id: session.id,
          payment_status: "pending",
        } as any)
        .eq("id", selectedSlot.id)
        .eq("is_booked", false);

      if (bookingError) throw bookingError;

      // Get court manager ID to create chat conversation for this session
      if (court.venues) {
        const { data: venue } = await supabase
          .from("venues")
          .select("owner_id")
          .eq("id", court.venue_id)
          .single();

        if (venue) {
          // Calculate expires_at (48h after session ends)
          const sessionEndTime = new Date(`${selectedSlot.available_date}T${selectedSlot.end_time}`);
          const expiresAt = new Date(sessionEndTime.getTime() + 48 * 60 * 60 * 1000);

          // Create chat conversation for this session (wrapped in try-catch to not block booking)
          try {
            await supabase
              .from("chat_conversations")
              .insert({
                organizer_id: user.id,
                court_manager_id: venue.owner_id,
                booking_id: selectedSlot.id,
                session_id: session.id,
                expires_at: expiresAt.toISOString(),
              } as any);
          } catch (chatError) {
            console.error("Error creating chat conversation:", chatError);
          }
        }
      }

      // Check if court requires payment at booking
      if (court.payment_timing === "at_booking") {
        // Redirect to Stripe payment
        toast({
          title: isNewGroup ? "Group created!" : "Booking created!",
          description: "Redirecting to payment...",
        });

        try {
          const { data: paymentData, error: paymentError } = await supabase.functions.invoke("create-payment", {
            body: {
              sessionId: session.id,
              paymentType: "at_booking",
              returnUrl: `/courts/${court.id}`,
              origin: window.location.origin,
            },
          });

          if (paymentError) throw paymentError;

          if (paymentData?.url) {
            // Detect if running inside an iframe (preview mode)
            const isInIframe = window.self !== window.top;
            if (isInIframe) {
              // In preview: open in new tab since Stripe won't render in iframe
              const opened = window.open(paymentData.url, "_blank", "noopener,noreferrer");
              if (!opened) window.location.href = paymentData.url;
            } else {
              // Standalone: redirect in same tab for better mobile UX
              window.location.href = paymentData.url;
            }
            return;
          }
        } catch (paymentErr) {
          console.error("Error initiating payment:", paymentErr);
          toast({
            title: "Payment redirect failed",
            description: "Your booking is saved. Please make payment from the game details page.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: isNewGroup ? "Group created & court booked!" : "Court booked!",
          description: `You've booked ${court.name} on ${format(
            new Date(selectedSlot.available_date),
            "MMMM d"
          )} at ${selectedSlot.start_time}. Check your games for details.`,
        });
      }

      // Update UI
      setAvailability((prev) => prev.filter((s) => s.id !== selectedSlot.id));
      setSelectedSlot(null);
      fetchAvailability();
    } catch (error: any) {
      toast({
        title: "Booking failed",
        description:
          error?.message ||
          "There was an error processing your booking. Please try again.",
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

  // Get court photo
  const getCourtPhotos = (): string[] => {
    if (!court) return [];
    if (court.photo_url) return [court.photo_url];
    return [];
  };

  const photos = court ? getCourtPhotos() : [];

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % photos.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  // Use public layout for unauthenticated users
  const Layout = user ? MobileLayout : PublicLayout;
  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!court) {
    return (
      <Layout>
        <div className="p-4 text-center">
          <p>Court not found.</p>
          <Link to="/courts">
            <Button variant="link">Back to Courts</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="pb-32">
        {/* Back Button */}
        <div className="p-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        {/* Image Gallery */}
        {photos.length > 0 ? (
          <>
            {/* Main Gallery View */}
            {photos.length === 1 ? (
              // Single image
              <div className="aspect-video bg-muted relative">
                <img 
                  src={photos[0]} 
                  alt={court.name}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => setShowGallery(true)}
                />
                <Badge className="absolute top-4 left-4 capitalize">
                  <SportIcon sport={court.sport_type} className="h-3 w-3 mr-1" />
                  {court.sport_type}
                </Badge>
              </div>
            ) : photos.length === 2 ? (
              // Two images side by side
              <div className="grid grid-cols-2 gap-1 aspect-video">
                {photos.map((photo, index) => (
                  <div key={index} className="relative overflow-hidden">
                    <img 
                      src={photo} 
                      alt={`${court.name} ${index + 1}`}
                      className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => {
                        setCurrentImageIndex(index);
                        setShowGallery(true);
                      }}
                    />
                    {index === 0 && (
                      <Badge className="absolute top-4 left-4 capitalize">
                        <SportIcon sport={court.sport_type} className="h-3 w-3 mr-1" />
                        {court.sport_type}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              // 3-4 images in grid layout
              <div className="grid grid-cols-4 grid-rows-2 gap-1 aspect-[2/1]">
                {/* Main large image */}
                <div className="col-span-2 row-span-2 relative overflow-hidden">
                  <img 
                    src={photos[0]} 
                    alt={court.name}
                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => {
                      setCurrentImageIndex(0);
                      setShowGallery(true);
                    }}
                  />
                  <Badge className="absolute top-4 left-4 capitalize">
                    <SportIcon sport={court.sport_type} className="h-3 w-3 mr-1" />
                    {court.sport_type}
                  </Badge>
                </div>
                {/* Secondary images */}
                {photos.slice(1, 5).map((photo, index) => (
                  <div key={index} className="relative overflow-hidden">
                    <img 
                      src={photo} 
                      alt={`${court.name} ${index + 2}`}
                      className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => {
                        setCurrentImageIndex(index + 1);
                        setShowGallery(true);
                      }}
                    />
                    {/* Show all photos button on last visible image */}
                    {index === Math.min(photos.length - 2, 3) && photos.length > 4 && (
                      <div 
                        className="absolute inset-0 bg-black/50 flex items-center justify-center cursor-pointer"
                        onClick={() => setShowGallery(true)}
                      >
                        <span className="text-white font-medium">+{photos.length - 4} more</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Show all photos button */}
            {photos.length > 1 && (
              <div className="px-4 py-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => setShowGallery(true)}
                >
                  Show all {photos.length} photos
                </Button>
              </div>
            )}

            {/* Fullscreen Gallery Modal */}
            {showGallery && (
              <div className="fixed inset-0 z-50 bg-black flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 text-white">
                  <span className="font-medium">{currentImageIndex + 1} / {photos.length}</span>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={() => setShowGallery(false)}
                  >
                    <X className="h-6 w-6" />
                  </Button>
                </div>

                {/* Image */}
                <div className="flex-1 flex items-center justify-center relative px-4">
                  <img 
                    src={photos[currentImageIndex]} 
                    alt={`${court.name} ${currentImageIndex + 1}`}
                    className="max-w-full max-h-full object-contain"
                  />

                  {/* Navigation arrows */}
                  {photos.length > 1 && (
                    <>
                      <button
                        onClick={prevImage}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-lg"
                      >
                        <ChevronLeft className="h-6 w-6 text-gray-800" />
                      </button>
                      <button
                        onClick={nextImage}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-lg"
                      >
                        <ChevronRight className="h-6 w-6 text-gray-800" />
                      </button>
                    </>
                  )}
                </div>

                {/* Thumbnail strip */}
                {photos.length > 1 && (
                  <div className="p-4 flex justify-center gap-2 overflow-x-auto">
                    {photos.map((photo, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                        className={`w-16 h-16 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${
                          index === currentImageIndex 
                            ? 'border-white opacity-100' 
                            : 'border-transparent opacity-60 hover:opacity-80'
                        }`}
                      >
                        <img 
                          src={photo} 
                          alt={`Thumbnail ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          // No photos placeholder
          <div className="aspect-video bg-muted relative flex items-center justify-center">
            <SportIcon sport={court.sport_type} className="h-16 w-16 text-muted-foreground" />
            <Badge className="absolute top-4 left-4 capitalize">
              <SportIcon sport={court.sport_type} className="h-3 w-3 mr-1" />
              {court.sport_type}
            </Badge>
          </div>
        )}

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
          <div className="fixed left-0 right-0 p-4 glass border-t border-border lg:bottom-0" style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}>
            <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
              <div>
                <div className="font-semibold">${court.hourly_rate}</div>
                <div className="text-sm text-muted-foreground">
                  {format(new Date(selectedSlot.available_date), "MMM d")} • {selectedSlot.start_time.slice(0, 5)}
                </div>
              </div>
              {user ? (
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
              ) : (
                <Link to="/auth">
                  <Button className="gap-2">
                    <LogIn className="h-4 w-4" />
                    Login to Book
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Group Selection Modal */}
        {court && selectedSlot && (
          <GroupSelectionModal
            open={showGroupModal}
            onOpenChange={setShowGroupModal}
            onConfirm={handleGroupConfirm}
            sportType={court.sport_type}
            courtPrice={court.hourly_rate}
            dayOfWeek={getDay(new Date(selectedSlot.available_date))}
            startTime={selectedSlot.start_time}
            city={court.venues?.city || ""}
            slotDate={selectedSlot.available_date}
            slotStartTime={selectedSlot.start_time}
            slotEndTime={selectedSlot.end_time}
            courtName={court.name}
          />
        )}
      </div>
    </Layout>
  );
}
