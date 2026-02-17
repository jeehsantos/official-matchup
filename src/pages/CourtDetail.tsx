import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
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
  DollarSign,
  CheckCircle2,
  Loader2,
  CalendarDays,
  LogIn,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
  Expand,
  FileText,
  Package,
  Zap,
  Lock,
  Users
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { format, getDay } from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import { BookingWizard } from "@/components/booking/BookingWizard";
import { QuickChallengeWizard } from "@/components/booking/QuickChallengeWizard";
import { ProfileCompletionAlert } from "@/components/booking/ProfileCompletionAlert";
import { EquipmentSelector, type SelectedEquipment } from "@/components/booking/EquipmentSelector";
import { checkProfileComplete } from "@/lib/profile-utils";
import { useVenueEquipment } from "@/hooks/useVenueEquipment";
import { useUserCredits } from "@/hooks/useUserCredits";
import { PaymentMethodDialog } from "@/components/payment/PaymentMethodDialog";
import { PaymentTimingChoice } from "@/components/booking/PaymentTimingChoice";
import { HoldCountdown } from "@/components/booking/HoldCountdown";
import { SlotStatusBadge } from "@/components/booking/SlotStatusBadge";
import { useBookingHold } from "@/hooks/useBookingHold";
import { useSlotPresence } from "@/hooks/useSlotPresence";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Court = Database["public"]["Tables"]["courts"]["Row"];
type Venue = Database["public"]["Tables"]["venues"]["Row"];

interface CourtWithVenue extends Omit<Court, 'photo_urls'> {
  venues: Venue | null;
  photo_urls?: string[] | null;
}

interface AvailableCourt {
  id: string;
  name: string;
  hourly_rate: number;
  ground_type: string | null;
  rules: string | null;
  photo_urls: string[] | null;
}

type SlotStatus = "AVAILABLE" | "HELD" | "CONFIRMED";

interface AvailableSlot {
  start_time: string;
  status: SlotStatus;
  held_by_current_user?: boolean;
  hold_expires_at?: string;
  available_durations: number[];
  available_courts?: AvailableCourt[];
}

interface AvailabilityResponse {
  available: boolean;
  reason?: string;
  window?: {
    start_time: string;
    end_time: string;
  };
  slot_interval_minutes?: number;
  max_booking_minutes?: number;
  slots: AvailableSlot[];
  venue_courts?: AvailableCourt[];
}

// Map facility names to emoji icons
function getFacilityIcon(facility: string): string {
  const lower = facility.toLowerCase();
  if (lower.includes("changing") || lower.includes("locker room")) return "🚪";
  if (lower.includes("shower")) return "🚿";
  if (lower.includes("locker")) return "🔒";
  if (lower.includes("parking")) return "🅿️";
  if (lower.includes("restroom") || lower.includes("toilet")) return "🚻";
  if (lower.includes("water") || lower.includes("fountain")) return "💧";
  if (lower.includes("first aid")) return "🩹";
  if (lower.includes("wi-fi") || lower.includes("wifi")) return "📶";
  if (lower.includes("seat") || lower.includes("spectator")) return "💺";
  if (lower.includes("cafe") || lower.includes("food")) return "☕";
  return "✅";
}

export default function CourtDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [court, setCourt] = useState<CourtWithVenue | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showQuickChallengeWizard, setShowQuickChallengeWizard] = useState(false);
  const [showProfileAlert, setShowProfileAlert] = useState(false);
  const [profileMissingFields, setProfileMissingFields] = useState<string[]>([]);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [showPaymentTimingChoice, setShowPaymentTimingChoice] = useState(false);
  const [pendingPaymentSessionId, setPendingPaymentSessionId] = useState<string | null>(null);
  const [pendingPaymentAmount, setPendingPaymentAmount] = useState<number>(0);
  
  // Quick game mode detection
  const isQuickGameMode = searchParams.get("quickGame") === "true";
  const [quickGameConfig, setQuickGameConfig] = useState<{
    sportCategoryId: string;
    sportName: string;
    sportLabel: string;
    gameMode: string;
    totalPlayers: number;
  } | null>(null);
  
  // Load quick game config from sessionStorage when in quick game mode
  useEffect(() => {
    if (isQuickGameMode) {
      try {
        const stored = sessionStorage.getItem("quickGameConfig");
        if (stored) {
          setQuickGameConfig(JSON.parse(stored));
        }
      } catch {
        console.error("Failed to parse quickGameConfig from sessionStorage");
      }
    } else {
      setQuickGameConfig(null);
    }
  }, [isQuickGameMode]);
  
  // Fetch user credits
  const { balance: credits, loading: loadingCredits, refetch: refetchCredits } = useUserCredits();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showGallery, setShowGallery] = useState(false);
  
  // Equipment state
  const [selectedEquipment, setSelectedEquipment] = useState<SelectedEquipment[]>([]);
  
  // Availability state
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityData, setAvailabilityData] = useState<AvailabilityResponse | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  
  // Booking hold hook
  const { 
    holdId, 
    remainingSeconds, 
    isCreatingHold, 
    createHold, 
    releaseHold, 
    isHoldValid 
  } = useBookingHold();
  
  // Presence tracking for slot selection
  const { trackSelection, isSlotBeingSelected } = useSlotPresence(
    court?.venue_id || null,
    selectedDate ? format(selectedDate, "yyyy-MM-dd") : null
  );
  
  // Fetch venue equipment
  const { data: venueEquipment = [] } = useVenueEquipment(court?.venue_id || null);
  
  // Refs to prevent race conditions during state restoration
  const isRestoringRef = useRef(false);
  const hasRestoredRef = useRef(false);

  // Function declarations first (before useEffects that use them)
  const fetchCourt = useCallback(async () => {
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
      setSelectedCourtId(data.id);
    } catch (error) {
      console.error("Error fetching court:", error);
      navigate("/courts");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  const fetchAvailability = useCallback(async (venueId: string, courtId: string, date: Date) => {
    setAvailabilityLoading(true);
    setAvailabilityError(null);

    try {
      const { data, error } = await supabase.functions.invoke("get-availability", {
        body: {
          venueId,
          courtId,
          date: format(date, "yyyy-MM-dd"),
        },
      });

      if (error) throw error;
      setAvailabilityData(data as AvailabilityResponse);
    } catch (error: any) {
      console.error("Error fetching availability:", error);
      setAvailabilityError(error.message || "Failed to load availability");
      setAvailabilityData(null);
    } finally {
      setAvailabilityLoading(false);
    }
  }, []);

  // Restore booking state from localStorage after auth redirect - only runs once
  useEffect(() => {
    if (hasRestoredRef.current) return;
    
    const savedBookingState = localStorage.getItem('pendingBookingState');
    if (savedBookingState && id) {
      try {
        const state = JSON.parse(savedBookingState);
        // Only restore if it's for the same court
        if (state.courtId === id) {
          isRestoringRef.current = true;
          hasRestoredRef.current = true;
          
          if (state.selectedDate) {
            setSelectedDate(new Date(state.selectedDate));
          }
          if (state.selectedSlots && state.selectedSlots.length > 0) {
            // Store normalized slots for restoration after availability loads
            const normalizedSlots = state.selectedSlots.map((s: string) => s.slice(0, 5));
            localStorage.setItem('pendingSlots', JSON.stringify(normalizedSlots));
          }
          if (state.selectedEquipment) {
            setSelectedEquipment(state.selectedEquipment);
          }
        }
        localStorage.removeItem('pendingBookingState');
      } catch (e) {
        console.error('Error restoring booking state:', e);
        localStorage.removeItem('pendingBookingState');
        localStorage.removeItem('pendingSlots');
      }
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchCourt();
    }
  }, [id, fetchCourt]);

  // Fetch availability when date or selected court changes
  useEffect(() => {
    if (court?.venues && selectedDate && selectedCourtId) {
      fetchAvailability(court.venues.id, selectedCourtId, selectedDate);
    }
  }, [court, selectedDate, selectedCourtId, fetchAvailability]);

  // Restore selected slots after availability loads - only if we're in restoration mode
  useEffect(() => {
    if (!availabilityData || availabilityLoading) return;
    
    const pendingSlots = localStorage.getItem('pendingSlots');
    if (pendingSlots && isRestoringRef.current) {
      try {
        const slots: string[] = JSON.parse(pendingSlots);
        // Filter to only include still-available slots (normalize both sides)
        const validSlots = slots.filter((slot: string) => {
          const normalizedSlot = slot.slice(0, 5);
          return availabilityData.slots.some(s => s.start_time.slice(0, 5) === normalizedSlot);
        });
        
        if (validSlots.length > 0) {
          setSelectedSlots(validSlots);
          toast({
            title: "Booking restored",
            description: `${validSlots.length} time slot(s) have been restored.`,
          });
        } else if (slots.length > 0) {
          toast({
            title: "Slots no longer available",
            description: "Your previously selected time slots are no longer available.",
            variant: "destructive",
          });
        }
      } catch (e) {
        console.error('Error restoring slots:', e);
      } finally {
        localStorage.removeItem('pendingSlots');
        isRestoringRef.current = false;
      }
    }
  }, [availabilityData, availabilityLoading, toast]);

  // Reset selected slots when date changes - but NOT during restoration
  useEffect(() => {
    // Skip reset during restoration
    if (isRestoringRef.current) return;
    
    // Clear slots when date changes (user-initiated date change)
    setSelectedSlots([]);
    setSelectedEquipment([]);
    // Release any existing hold when date changes
    releaseHold();
  }, [selectedDate, releaseHold]);

  // Track presence when slots are selected
  useEffect(() => {
    if (selectedSlots.length === 0) {
      trackSelection(null, null);
      return;
    }
    
    const startTime = selectedSlots.sort((a, b) => timeToMinutes(a) - timeToMinutes(b))[0];
    const endTime = getEndTime();
    trackSelection(startTime, endTime);
  }, [selectedSlots, trackSelection]);

  // Subscribe to booking_holds changes for real-time updates
  useEffect(() => {
    if (!court?.id) return;

    const channel = supabase
      .channel(`booking-holds-${court.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booking_holds',
          filter: `court_id=eq.${court.id}`,
        },
        (payload) => {
          console.log('Hold changed:', payload);
          // Skip refetch if the booking wizard is open to avoid disrupting the user
          if (showGroupModal || showQuickChallengeWizard) return;
          // Refetch availability when holds change
          if (court.venues && selectedDate) {
            fetchAvailability(court.venues.id, court.id, selectedDate);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [court?.id, court?.venues, selectedDate, fetchAvailability, showGroupModal, showQuickChallengeWizard]);

  // Real-time subscription for availability updates
  useEffect(() => {
    if (!court?.id) return;

    const channel = supabase
      .channel(`court-availability-${court.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'court_availability',
          filter: `court_id=eq.${court.id}`,
        },
        (payload) => {
          console.log('Availability changed:', payload);
          // Skip refetch if the booking wizard is open to avoid disrupting the user
          if (showGroupModal || showQuickChallengeWizard) return;
          // Refetch availability when changes occur
          if (court.venues && selectedDate) {
            fetchAvailability(court.venues.id, court.id, selectedDate);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [court?.id, court?.venues, selectedDate, fetchAvailability, showGroupModal, showQuickChallengeWizard]);

  // Convert time string to minutes for comparison
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };

  // Check if slots are consecutive
  const areSlotsConsecutive = (slots: string[]): boolean => {
    if (slots.length <= 1) return true;
    const sorted = [...slots].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
    const interval = availabilityData?.slot_interval_minutes || 30;
    
    for (let i = 1; i < sorted.length; i++) {
      const prevMinutes = timeToMinutes(sorted[i - 1]);
      const currMinutes = timeToMinutes(sorted[i]);
      if (currMinutes - prevMinutes !== interval) return false;
    }
    return true;
  };

  // Get available courts for a specific time slot
  const getAvailableCourtsForSlot = (slotTime: string): AvailableCourt[] => {
    const slot = availabilityData?.slots.find(s => s.start_time.slice(0, 5) === slotTime.slice(0, 5));
    return slot?.available_courts || [];
  };

  // Toggle slot selection
  const toggleSlot = (slotTime: string) => {
    const normalizedTime = slotTime.slice(0, 5);
    
    setSelectedSlots(prev => {
      // If already selected, remove it
      if (prev.includes(normalizedTime)) {
        return prev.filter(t => t !== normalizedTime);
      }
      
      // If this is the first selection, just add it
      if (prev.length === 0) {
        return [normalizedTime];
      }
      
      // Check if adding this slot would maintain consecutiveness
      const newSelection = [...prev, normalizedTime].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
      
      if (areSlotsConsecutive(newSelection)) {
        // Check if we're within max booking duration
        const interval = availabilityData?.slot_interval_minutes || 30;
        const maxMinutes = availabilityData?.max_booking_minutes || 120;
        const totalDuration = newSelection.length * interval;
        
        if (totalDuration <= maxMinutes) {
          return newSelection;
        } else {
          toast({
            title: "Maximum duration reached",
            description: `You can book up to ${formatDuration(maxMinutes)}`,
            variant: "destructive",
          });
          return prev;
        }
      }
      
      // If not consecutive, start fresh with this slot
      return [normalizedTime];
    });
  };

  // Calculate total duration from selected slots
  const getTotalDuration = (): number => {
    if (selectedSlots.length === 0) return 0;
    const interval = availabilityData?.slot_interval_minutes || 30;
    return selectedSlots.length * interval;
  };

  // Calculate end time from selected slots
  const getEndTime = (): string => {
    if (selectedSlots.length === 0) return "";
    const sorted = [...selectedSlots].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
    const lastSlot = sorted[sorted.length - 1];
    const interval = availabilityData?.slot_interval_minutes || 30;
    const endMinutes = timeToMinutes(lastSlot) + interval;
    return `${Math.floor(endMinutes / 60).toString().padStart(2, "0")}:${(endMinutes % 60).toString().padStart(2, "0")}`;
  };

  // Get start time from selected slots
  const getStartTime = (): string => {
    if (selectedSlots.length === 0) return "";
    const sorted = [...selectedSlots].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
    return sorted[0];
  };

  // Get selected court details
  const getSelectedCourt = (): AvailableCourt | null => {
    if (!selectedCourtId) return null;
    return availabilityData?.venue_courts?.find(c => c.id === selectedCourtId) || null;
  };

  // Calculate equipment total
  const getEquipmentTotal = (): number => {
    return selectedEquipment.reduce((sum, item) => sum + item.quantity * item.pricePerUnit, 0);
  };

  // Filter out past time slots for today - memoized for performance
  const filteredSlots = useMemo(() => {
    if (!availabilityData?.slots || !selectedDate) return [];
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const selected = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    
    // If selected date is not today, show all slots
    if (selected.getTime() !== today.getTime()) return availabilityData.slots;
    
    // Filter out past slots for today
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return availabilityData.slots.filter(slot => timeToMinutes(slot.start_time) > currentMinutes);
  }, [availabilityData?.slots, selectedDate]);

  const handleBookSlot = async () => {
    if (!user) {
      // Store current path for redirect after auth
      localStorage.setItem('redirectAfterAuth', window.location.pathname);
      // Store booking state to restore after auth
      localStorage.setItem('pendingBookingState', JSON.stringify({
        courtId: id,
        selectedDate: selectedDate?.toISOString(),
        selectedSlots: selectedSlots,
        selectedEquipment: selectedEquipment,
      }));
      toast({
        title: "Please sign in",
        description: "You need to be signed in to book a court.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    if (selectedSlots.length === 0 || !court || !selectedDate) return;

    const bookingCourtId = selectedCourtId || court.id;

    // Check profile completeness - use cached profile if available
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const { isComplete, missingFields } = checkProfileComplete(profile);

    if (!isComplete) {
      setProfileMissingFields(missingFields);
      setShowProfileAlert(true);
      return;
    }

    // Create a hold on the slot before proceeding to wizard
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const startTime = getStartTime();
    const endTime = getEndTime();
    const startDatetime = new Date(`${dateStr}T${startTime}:00`);
    const endDatetime = new Date(`${dateStr}T${endTime}:00`);

    const holdResult = await createHold(bookingCourtId, startDatetime, endDatetime);

    if (!holdResult.success) {
      // Hold failed - slot is taken
      if (holdResult.error === "SLOT_UNAVAILABLE") {
        toast({
          title: "Slot Unavailable",
          description: holdResult.message || "This slot was just taken by another user. Please select a different time.",
          variant: "destructive",
        });
        // Refresh availability
        if (court.venues) {
          fetchAvailability(court.venues.id, court.id, selectedDate);
        }
        setSelectedSlots([]);
      } else {
        toast({
          title: "Unable to reserve slot",
          description: holdResult.message || "Please try again.",
          variant: "destructive",
        });
      }
      return;
    }

    // Hold created successfully - proceed to wizard
    toast({
      title: "Slot Reserved!",
      description: `You have 10 minutes to complete your booking.`,
    });

    // Check if we're in quick game mode
    if (isQuickGameMode) {
      if (quickGameConfig) {
        setShowQuickChallengeWizard(true);
      } else {
        // Config is missing - show error and redirect to start
        toast({
          title: "Session expired",
          description: "Please start your Quick Challenge again.",
          variant: "destructive",
        });
        releaseHold();
        navigate("/discover");
      }
    } else {
      // Open normal booking wizard
      setShowGroupModal(true);
    }
  };

  const handleBookingConfirm = async (data: {
    groupId: string;
    isNewGroup: boolean;
    paymentType: "single" | "split";
    equipment: SelectedEquipment[];
    sportCategoryId: string;
  }) => {
    const { groupId, isNewGroup, paymentType, equipment, sportCategoryId } = data;
    // Update selected equipment from wizard
    setSelectedEquipment(equipment);
    if (selectedSlots.length === 0 || !court || !user || !selectedDate) return;

    setShowGroupModal(false);
    setBooking(true);

    const totalDuration = getTotalDuration();
    const startTime = getStartTime();
    const endTime = getEndTime();
    const bookingCourtId = selectedCourtId || court.id;
    const selectedCourtData = getSelectedCourt();
    const courtRate = selectedCourtData?.hourly_rate || court.hourly_rate;

    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const slotDate = new Date(dateStr);
      const paymentDeadline = new Date(slotDate);
      paymentDeadline.setHours(paymentDeadline.getHours() - 24);

      // Calculate price based on duration + equipment
      const hours = totalDuration / 60;
      const courtPrice = courtRate * hours;
      const equipmentTotal = getEquipmentTotal();
      const totalPrice = courtPrice + equipmentTotal;

      // Create a session for this booking
      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .insert({
          group_id: groupId,
          court_id: bookingCourtId,
          session_date: dateStr,
          start_time: startTime,
          duration_minutes: totalDuration,
          court_price: totalPrice,
          min_players: 6,
          max_players: court.capacity,
          payment_deadline: paymentDeadline.toISOString(),
          state: "protected",
          payment_type: paymentType,
          sport_category_id: sportCategoryId,
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Add the organizer as a session player automatically
      // Only confirm if payment is NOT required at booking time
      const requiresPaymentFirst = court.payment_timing === "at_booking";
      const { error: playerError } = await supabase
        .from("session_players")
        .insert({
          session_id: session.id,
          user_id: user.id,
          is_confirmed: !requiresPaymentFirst,
          confirmed_at: requiresPaymentFirst ? null : new Date().toISOString(),
        });

      if (playerError) {
        console.error("Error adding organizer as player:", playerError);
      }

      // Create a court_availability record for this booking (for tracking)
      const { data: bookingRecord, error: bookingError } = await supabase
        .from("court_availability")
        .insert({
          court_id: bookingCourtId,
          available_date: dateStr,
          start_time: startTime,
          end_time: endTime,
          is_booked: true,
          booked_by_user_id: user.id,
          booked_by_group_id: groupId,
          booked_by_session_id: session.id,
          payment_status: "pending",
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      // Save equipment selections if any
      if (selectedEquipment.length > 0) {
        const equipmentInserts = selectedEquipment.map(item => ({
          booking_id: bookingRecord.id,
          equipment_id: item.equipmentId,
          quantity: item.quantity,
          price_at_booking: item.pricePerUnit,
        }));

        const { error: equipmentError } = await supabase
          .from("booking_equipment")
          .insert(equipmentInserts);

        if (equipmentError) {
          console.error("Error saving equipment:", equipmentError);
        }
      }

      // Create chat conversation for this session
      if (court.venues) {
        const { data: venue } = await supabase
          .from("venues")
          .select("owner_id")
          .eq("id", court.venue_id)
          .single();

        if (venue) {
          const sessionEndTime = new Date(`${dateStr}T${endTime}`);
          const expiresAt = new Date(sessionEndTime.getTime() + 48 * 60 * 60 * 1000);

          try {
            await supabase
              .from("chat_conversations")
              .insert({
                organizer_id: user.id,
                court_manager_id: venue.owner_id,
                booking_id: bookingRecord.id,
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
        // Store session ID and amount for payment processing
        setPendingPaymentSessionId(session.id);
        setPendingPaymentAmount(totalPrice);

        toast({
          title: isNewGroup ? "Group created!" : "Booking reserved!",
          description: "Choose when to complete your payment...",
        });

        // Show pay now/later choice dialog
        setShowPaymentTimingChoice(true);
        return;
      } else {
        toast({
          title: isNewGroup ? "Group created & court booked!" : "Court booked!",
          description: `You've booked ${court.name} on ${format(selectedDate, "MMMM d")} at ${startTime}. Check your games for details.`,
        });
      }

      // Update UI
      setSelectedSlots([]);
      setSelectedEquipment([]);
      if (court.venues) {
        fetchAvailability(court.venues.id, court.id, selectedDate);
      }
    } catch (error: any) {
      toast({
        title: "Booking failed",
        description: error?.message || "There was an error processing your booking. Please try again.",
        variant: "destructive",
      });
    } finally {
      setBooking(false);
    }
  };

  // Handle Quick Challenge creation
  const handleQuickChallengeConfirm = async (data: {
    paymentType: "single" | "split";
    equipment: SelectedEquipment[];
  }) => {
    const { paymentType, equipment } = data;
    setSelectedEquipment(equipment);
    
    if (selectedSlots.length === 0 || !court || !user || !selectedDate || !quickGameConfig) return;

    setShowQuickChallengeWizard(false);
    setBooking(true);

    const totalDuration = getTotalDuration();
    const startTime = getStartTime();
    const endTime = getEndTime();
    const bookingCourtId = selectedCourtId || court.id;
    const selectedCourtData = getSelectedCourt();
    const courtRate = selectedCourtData?.hourly_rate || court.hourly_rate;

    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");

      // Calculate price based on duration + equipment
      const hours = totalDuration / 60;
      const courtPriceCalc = courtRate * hours;
      const equipmentTotal = equipment.reduce((sum, item) => sum + item.quantity * item.pricePerUnit, 0);
      const totalPrice = courtPriceCalc + equipmentTotal;
      const pricePerPlayer = paymentType === "split" 
        ? Math.ceil((totalPrice / quickGameConfig.totalPlayers) * 100) / 100 
        : 0;

      // Create quick_challenges record
      const { data: challenge, error: challengeError } = await supabase
        .from("quick_challenges")
        .insert({
          sport_category_id: quickGameConfig.sportCategoryId,
          game_mode: quickGameConfig.gameMode,
          venue_id: court.venue_id,
          court_id: bookingCourtId,
          scheduled_date: dateStr,
          scheduled_time: startTime,
          total_slots: quickGameConfig.totalPlayers,
          price_per_player: paymentType === "split" ? pricePerPlayer : 0,
          status: "open",
          created_by: user.id,
        })
        .select()
        .single();

      if (challengeError) throw challengeError;

      // Create court_availability record to mark the slot as booked
      const { data: bookingRecord, error: bookingError } = await supabase
        .from("court_availability")
        .insert({
          court_id: bookingCourtId,
          available_date: dateStr,
          start_time: startTime,
          end_time: endTime,
          is_booked: true,
          booked_by_user_id: user.id,
          payment_status: "pending",
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      // Save equipment selections if any
      if (equipment.length > 0) {
        const equipmentInserts = equipment.map(item => ({
          booking_id: bookingRecord.id,
          equipment_id: item.equipmentId,
          quantity: item.quantity,
          price_at_booking: item.pricePerUnit,
        }));

        await supabase.from("booking_equipment").insert(equipmentInserts);
      }

      // Auto-add creator as first player
      const { error: playerError } = await supabase
        .from("quick_challenge_players")
        .insert({
          challenge_id: challenge.id,
          user_id: user.id,
          team: "left",
          slot_position: 0,
          payment_status: paymentType === "single" ? "pending" : "pending",
        });

      if (playerError) {
        console.error("Error adding creator as player:", playerError);
      }

      // Clear quick game state
      sessionStorage.removeItem("quickGameConfig");

      toast({
        title: "Quick Challenge Created!",
        description: `Your ${quickGameConfig.gameMode} challenge is now open for players to join.`,
      });

      // Navigate to discover page with quick games filter
      navigate("/discover?tab=quickgames");

    } catch (error: any) {
      console.error("Error creating quick challenge:", error);
      toast({
        title: "Failed to create challenge",
        description: error?.message || "There was an error creating your quick challenge. Please try again.",
        variant: "destructive",
      });
    } finally {
      setBooking(false);
    }
  };

  const handleSelectPaymentMethod = async (
    method: "credits" | "payment",
    creditsToUse?: number
  ) => {
    if (!pendingPaymentSessionId || !court) return;
    
    setBooking(true);
    try {
      if (method === "credits") {
        // Calculate total cost
        const equipmentTotal = selectedEquipment.reduce(
          (sum, item) => sum + item.quantity * item.pricePerUnit,
          0
        );
        const totalCost = court.hourly_rate + equipmentTotal;

        // If credits cover the full amount, process with credits only
        if (credits >= totalCost) {
          const { data, error } = await supabase.functions.invoke("create-payment", {
            body: {
              sessionId: pendingPaymentSessionId,
              paymentType: "at_booking",
              returnUrl: `/courts/${court.id}`,
              origin: window.location.origin,
              useCredits: true,
              creditsAmount: creditsToUse,
            },
          });

          if (error) throw error;

          if (data?.success) {
            // Payment completed with credits only
            toast({
              title: "Payment Complete",
              description: data.message || "Payment completed using your credits.",
            });
            setShowCreditsModal(false);
            setPendingPaymentSessionId(null);
            refetchCredits();
            
            // Update UI
            setSelectedSlots([]);
            setSelectedEquipment([]);
            if (court.venues) {
              fetchAvailability(court.venues.id, court.id, selectedDate);
            }
            return;
          }
        }

        // Partial credits - proceed to Stripe with credits applied
        await processCourtPayment(pendingPaymentSessionId, true, creditsToUse);
      } else {
        // Pay with card only
        await processCourtPayment(pendingPaymentSessionId, false);
      }
    } catch (error) {
      console.error("Error processing payment:", error);
      toast({
        title: "Payment Error",
        description: "Failed to process payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setBooking(false);
    }
  };

  // Handler for pay now/later choice
  const handlePaymentTimingChoice = async (choice: "now" | "later") => {
    if (!pendingPaymentSessionId || !court) return;

    setBooking(true);
    try {
      if (choice === "now") {
        // User chose to pay now - check for credits first
        const totalCost = court.hourly_rate + selectedEquipment.reduce((sum, item) => sum + item.quantity * item.pricePerUnit, 0);
        if (credits >= totalCost && !loadingCredits) {
          setShowPaymentTimingChoice(false);
          setShowCreditsModal(true);
        } else {
          // No credits, proceed directly to Stripe
          setShowPaymentTimingChoice(false);
          await processCourtPayment(pendingPaymentSessionId, false);
        }
      } else {
        // User chose to pay later - booking is already created with pending status
        setShowPaymentTimingChoice(false);
        setPendingPaymentSessionId(null);
        setPendingPaymentAmount(0);
        
        toast({
          title: "Booking Reserved!",
          description: "Your court is reserved. Complete payment from the game details page before the session starts.",
        });
        
        // Navigate to the game details page
        navigate(`/games`);
      }
    } catch (error) {
      console.error("Error processing payment choice:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setBooking(false);
    }
  };

  const processCourtPayment = async (sessionId: string, useCredits: boolean, creditsAmount?: number) => {
    if (!court) return;

    try {
      const { data: paymentData, error: paymentError } = await supabase.functions.invoke("create-payment", {
        body: {
          sessionId,
          paymentType: "at_booking",
          returnUrl: `/courts/${court.id}`,
          origin: window.location.origin,
          useCredits,
          creditsAmount,
        },
      });

      if (paymentError) throw paymentError;

      if (paymentData?.url) {
        setShowCreditsModal(false);
        setPendingPaymentSessionId(null);
        const isInIframe = window.self !== window.top;
        if (isInIframe) {
          const opened = window.open(paymentData.url, "_blank", "noopener,noreferrer");
          if (!opened) window.location.href = paymentData.url;
        } else {
          window.location.href = paymentData.url;
        }
        return;
      } else if (paymentData?.success) {
        // Payment completed with credits only
        toast({
          title: "Payment Complete",
          description: paymentData.message || "Payment completed successfully.",
        });
        setShowCreditsModal(false);
        setPendingPaymentSessionId(null);
        refetchCredits();
        
        // Update UI
        setSelectedSlots([]);
        setSelectedEquipment([]);
        if (court.venues) {
          fetchAvailability(court.venues.id, court.id, selectedDate);
        }
      }
    } catch (paymentErr) {
      console.error("Error initiating payment:", paymentErr);
      toast({
        title: "Payment redirect failed",
        description: "Your booking is saved. Please make payment from the game details page.",
        variant: "destructive",
      });
    }
  };

  // Get court photos based on selected court (support both photo_urls array and legacy photo_url)
  const getCourtPhotos = (): string[] => {
    // First check if we have a selected court from the dropdown
    const selectedCourt = getSelectedCourt();
    if (selectedCourt) {
      if (selectedCourt.photo_urls && Array.isArray(selectedCourt.photo_urls) && selectedCourt.photo_urls.length > 0) {
        return selectedCourt.photo_urls;
      }
    }
    
    // Fallback to main court
    if (!court) return [];
    const photos = (court as any).photo_urls;
    if (photos && Array.isArray(photos) && photos.length > 0) {
      return photos;
    }
    if (court.photo_url) return [court.photo_url];
    return [];
  };

  const photos = court ? getCourtPhotos() : [];
  
  // Reset image index when photos change (due to court selection)
  useEffect(() => {
    setCurrentImageIndex(0);
  }, [selectedCourtId]);

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % photos.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  // Format duration for display
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  // Calculate price for duration
  const calculatePrice = (durationMinutes: number): number => {
    const selectedCourtData = getSelectedCourt();
    const rate = selectedCourtData?.hourly_rate || court?.hourly_rate || 0;
    return rate * (durationMinutes / 60);
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

  const totalDuration = getTotalDuration();
  const courtPrice = calculatePrice(totalDuration);
  const equipmentTotal = getEquipmentTotal();
  const totalPrice = courtPrice + equipmentTotal;
  const venueCourts = availabilityData?.venue_courts || [];

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

        {/* Quick Game Mode Banner */}
        {isQuickGameMode && quickGameConfig && (
          <div className="px-4 mb-4">
            <div className="bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 rounded-lg p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm sm:text-base truncate">Quick Challenge Mode</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">
                    {quickGameConfig.sportName} • {quickGameConfig.gameMode} ({quickGameConfig.totalPlayers} players)
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Select a date and time slot, then click "Book Now" to create your quick challenge
              </p>
            </div>
          </div>
        )}

        {/* Main Content - Two Column Layout on Desktop */}
        <div className="lg:grid lg:grid-cols-3 lg:gap-6 lg:px-6">
          {/* Left Column - Details and Booking */}
          <div className="lg:col-span-2 space-y-6">
            {/* Court Header */}
            <div className="px-4 lg:px-0">
              <div className="flex items-start gap-3 mb-3">
                <Badge className="capitalize shrink-0">
                  <SportIcon sport={court.sport_type} className="h-3 w-3 mr-1" />
                  {court.sport_type}
                </Badge>
                <Badge variant="outline" className="shrink-0">
                  {court.is_indoor ? "Indoor" : "Outdoor"}
                </Badge>
                {venueCourts.length > 1 && (
                  <Badge variant="secondary" className="shrink-0">
                    {venueCourts.length} courts available
                  </Badge>
                )}
              </div>
              <h1 className="font-display text-2xl lg:text-3xl font-bold mb-2">{court.venues?.name || court.name}</h1>
              {court.venues && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span>{court.venues.address}, {court.venues.city}</span>
                </div>
              )}
            </div>

            {/* Mobile Photo Gallery */}
            <div className="lg:hidden">
              {photos.length > 0 ? (
                <div className="relative aspect-video bg-muted">
                  <img 
                    src={photos[currentImageIndex]} 
                    alt={court.name}
                    className="w-full h-full object-cover"
                    onClick={() => setShowGallery(true)}
                  />
                  
                  {/* Navigation arrows for mobile */}
                  {photos.length > 1 && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); prevImage(); }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 flex items-center justify-center text-white active:bg-black/70"
                        aria-label="Previous photo"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); nextImage(); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 flex items-center justify-center text-white active:bg-black/70"
                        aria-label="Next photo"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                      
                      {/* Dot indicators */}
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {photos.map((_, index) => (
                          <button
                            key={index}
                            onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(index); }}
                            className={`w-2 h-2 rounded-full transition-all ${
                              index === currentImageIndex ? 'bg-white scale-110' : 'bg-white/50'
                            }`}
                            aria-label={`Go to photo ${index + 1}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                  
                  {photos.length > 1 && (
                    <button 
                      onClick={() => setShowGallery(true)}
                      className="absolute bottom-3 right-3 bg-black/70 text-white text-sm px-3 py-1.5 rounded-full flex items-center gap-1.5"
                    >
                      <Expand className="h-3.5 w-3.5" />
                      {photos.length} photos
                    </button>
                  )}
                </div>
              ) : (
                <div className="aspect-video bg-muted flex items-center justify-center">
                  <SportIcon sport={court.sport_type} className="h-16 w-16 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Quick Info with Court Selector */}
            <div className="px-4 lg:px-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Court Selector - Responsive Glassmorphism styled dropdown */}
                <div className="relative group bg-[#111a27]/60 backdrop-blur-2xl border border-[#00f2ea]/20 p-3 sm:p-4 rounded-2xl shadow-2xl transition-all hover:border-[#00f2ea]/50 col-span-3 sm:col-span-1">
                  <label className="block text-[10px] uppercase text-gray-400 font-bold tracking-widest mb-1 opacity-70">
                    Select Court
                  </label>
                  <div className="flex items-center justify-between min-w-0">
                    {venueCourts.length > 0 ? (
                      <>
                        <select 
                          value={selectedCourtId || ""}
                          onChange={(e) => {
                            setSelectedCourtId(e.target.value);
                            // Reset slots and image index when court changes
                            setSelectedSlots([]);
                            setCurrentImageIndex(0);
                          }}
                          className="bg-transparent text-[#00f2ea] font-bold sm:font-extrabold text-sm sm:text-lg outline-none cursor-pointer w-full appearance-none pr-6 truncate min-w-0"
                        >
                          {venueCourts.map((c) => (
                            <option key={c.id} value={c.id} className="bg-[#0a0f18] text-white text-sm">
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-[#00f2ea] text-xs sm:text-sm">▼</div>
                      </>
                    ) : (
                      <span className="text-[#00f2ea] font-bold sm:font-extrabold text-sm sm:text-lg truncate">{court.name}</span>
                    )}
                  </div>
                  <div className="text-[10px] uppercase text-gray-400 font-bold tracking-widest">court name</div>
                </div>
                
                {/* Price - Dynamic based on selected court */}
                <div className="bg-[#111a27]/60 backdrop-blur-2xl border border-[#00f2ea]/20 rounded-2xl p-4 text-center transition-all hover:border-[#00f2ea]/50">
                  <DollarSign className="h-5 w-5 mx-auto mb-2 text-[#00f2ea]" />
                  <div className="font-extrabold text-lg text-white">
                    ${getSelectedCourt()?.hourly_rate || court.hourly_rate}
                  </div>
                  <div className="text-[10px] uppercase text-gray-400 font-bold tracking-widest">per hour</div>
                </div>
                
                {/* Surface - Dynamic based on selected court */}
                <div className="bg-[#111a27]/60 backdrop-blur-2xl border border-[#00f2ea]/20 rounded-2xl p-4 text-center transition-all hover:border-[#00f2ea]/50">
                  <div className="h-5 w-5 mx-auto mb-2 text-[#00f2ea] flex items-center justify-center text-lg">
                    {court.is_indoor ? "🏢" : "🌳"}
                  </div>
                  <div className="font-extrabold text-lg text-white capitalize">
                    {getSelectedCourt()?.ground_type || court.ground_type || "turf"}
                  </div>
                  <div className="text-[10px] uppercase text-gray-400 font-bold tracking-widest">surface</div>
                </div>
              </div>
            </div>

            {/* Venue Details: Allowed Sports + Amenities */}
            {((court.venues?.amenities && court.venues.amenities.length > 0) || (court.allowed_sports && court.allowed_sports.length > 0)) && (
              <div className="px-4 lg:px-0 space-y-4">
                {/* Allowed Sports */}
                {court.allowed_sports && court.allowed_sports.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <span className="text-lg">🏅</span>
                      Sports Available
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {court.allowed_sports.map((sport: string, i: number) => (
                        <Badge key={i} variant="secondary" className="gap-1.5 py-1 px-3">
                          <SportIcon sport={sport} size="sm" className="w-5 h-5 text-xs" />
                          <span className="capitalize">{sport.replace(/_/g, " ")}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Facilities / Amenities */}
                {court.venues?.amenities && court.venues.amenities.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <span className="text-lg">🏢</span>
                      Facilities
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {court.venues.amenities.map((amenity, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 text-sm border border-border"
                        >
                          <span className="text-base">{getFacilityIcon(amenity)}</span>
                          {amenity}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Court Rules - Dynamic based on selected court */}
            {(getSelectedCourt()?.rules || (court as any).rules) && (
              <div className="px-4 lg:px-0">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Court Rules & Guidelines
                </h3>
                <div className="bg-muted/50 rounded-xl p-4 text-sm text-muted-foreground whitespace-pre-wrap border border-border">
                  {getSelectedCourt()?.rules || (court as any).rules}
                </div>
              </div>
            )}

            {/* Date Selection */}
            <div className="px-4 lg:px-0">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Select a Date
              </h3>
              <div className="bg-card rounded-xl border border-border p-4">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date()}
                  className="w-full"
                  classNames={{
                    months: "flex flex-col w-full",
                    month: "space-y-4 w-full",
                    table: "w-full border-collapse",
                    head_row: "flex justify-between",
                    head_cell: "flex-1 text-center text-muted-foreground rounded-md font-normal text-sm",
                    row: "flex w-full mt-2 justify-between",
                    cell: "flex-1 text-center text-sm p-0 relative max-w-[3rem] lg:max-w-[3.5rem]",
                    day: "h-10 w-full lg:h-11 p-0 font-normal hover:bg-accent rounded-md transition-colors",
                    day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                    day_today: "bg-accent text-accent-foreground",
                    day_disabled: "text-muted-foreground opacity-50",
                    day_outside: "text-muted-foreground opacity-50",
                  }}
                />
              </div>
            </div>

            {/* Time Slots */}
            {selectedDate && (
              <div className="px-4 lg:px-0">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Available Times for {format(selectedDate, "MMMM d")}
                </h3>
                
                {availabilityLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-2 text-muted-foreground">Loading availability...</span>
                  </div>
                ) : availabilityError ? (
                  <div className="flex items-center gap-2 text-destructive py-4">
                    <AlertCircle className="h-5 w-5" />
                    <span>{availabilityError}</span>
                  </div>
                ) : !availabilityData?.available ? (
                  <div className="bg-muted/50 rounded-lg p-4 text-center">
                    <p className="text-muted-foreground">
                      {availabilityData?.reason === "closed" 
                        ? "Venue is closed on this date." 
                        : "No availability for this date."}
                    </p>
                  </div>
                ) : availabilityData.slots.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    All slots are booked for this date. Try another day.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {/* Venue hours info */}
                    {availabilityData.window && (
                      <div className="text-sm text-muted-foreground">
                        Open: {availabilityData.window.start_time.slice(0, 5)} - {availabilityData.window.end_time.slice(0, 5)}
                      </div>
                    )}
                    
                    {/* Note: Court selector is now in Quick Info bar above */}
                    
                    {/* Instruction */}
                    <p className="text-sm text-muted-foreground">
                      Tap to select consecutive time slots. Tap again to deselect.
                    </p>
                    
                    {/* Time slot grid */}
                    {filteredSlots.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>{availabilityData.slots.length > 0 ? "No more available slots for today" : "No available slots for this date"}</p>
                      </div>
                    ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                      {filteredSlots.map((slot) => {
                        const slotTime = slot.start_time.slice(0, 5);
                        const isSelected = selectedSlots.includes(slotTime);
                        const availableCourts = slot.available_courts || [];
                        const isAvailableForSelectedCourt = !selectedCourtId || 
                          availableCourts.some(c => c.id === selectedCourtId);
                        
                        // Determine slot status
                        const slotStatus = slot.status || "AVAILABLE";
                        const isBooked = slotStatus === "CONFIRMED";
                        const isHeld = slotStatus === "HELD" && !slot.held_by_current_user;
                        const isSomeoneSelecting = isSlotBeingSelected(slotTime);
                        const isDisabled = isBooked || isHeld || !isAvailableForSelectedCourt;
                        
                        return (
                          <Button
                            key={slot.start_time}
                            variant={isSelected ? "default" : isBooked ? "ghost" : "outline"}
                            className={`h-auto py-2.5 px-2 transition-all relative ${
                              isSelected 
                                ? "ring-2 ring-primary ring-offset-2 ring-offset-background" 
                                : isBooked
                                ? "opacity-40 cursor-not-allowed line-through"
                                : isHeld
                                ? "border-warning/50 bg-warning/5 opacity-60 cursor-not-allowed"
                                : isSomeoneSelecting
                                ? "border-muted-foreground/50 bg-muted/30"
                                : "hover:border-primary/50"
                            }`}
                            onClick={() => !isDisabled && toggleSlot(slot.start_time)}
                            disabled={isDisabled}
                          >
                            <div className="text-center">
                              <span className={`text-sm font-medium ${isBooked ? "line-through" : ""}`}>
                                {slotTime}
                              </span>
                              {/* Status indicators */}
                              {isBooked && (
                                <span className="block text-[9px] text-muted-foreground">
                                  <CheckCircle2 className="h-3 w-3 inline mr-0.5" />Booked
                                </span>
                              )}
                              {isHeld && !isBooked && (
                                <span className="block text-[9px] text-warning">
                                  <Lock className="h-3 w-3 inline mr-0.5" />Held
                                </span>
                              )}
                              {isSomeoneSelecting && !isBooked && !isHeld && !isSelected && (
                                <span className="block text-[9px] text-muted-foreground">
                                  <Users className="h-3 w-3 inline mr-0.5" />
                                </span>
                              )}
                              {slot.held_by_current_user && !isSelected && (
                                <span className="block text-[9px] text-primary">
                                  Your hold
                                </span>
                              )}
                              {venueCourts.length > 1 && !selectedCourtId && !isBooked && !isHeld && (
                                <span className="block text-[10px] text-muted-foreground">
                                  {availableCourts.length} court{availableCourts.length !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </Button>
                        );
                      })}
                    </div>
                    )}

                    {/* Selected slots summary */}
                    {selectedSlots.length > 0 && (
                      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Selected Time</span>
                          <button 
                            onClick={() => setSelectedSlots([])}
                            className="text-sm text-muted-foreground hover:text-foreground"
                          >
                            Clear
                          </button>
                        </div>
                        <div className="flex items-center gap-2 text-lg font-semibold">
                          <Clock className="h-5 w-5 text-primary" />
                          {getStartTime()} - {getEndTime()}
                          <span className="text-muted-foreground font-normal text-sm">
                            ({formatDuration(totalDuration)})
                          </span>
                        </div>
                        
                        {/* Hold countdown */}
                        {isHoldValid && remainingSeconds > 0 && (
                          <HoldCountdown remainingSeconds={remainingSeconds} />
                        )}
                        
                        {/* Price breakdown */}
                        <div className="space-y-1 pt-2 border-t border-primary/10">
                          <div className="flex justify-between text-sm">
                            <span>Court ({formatDuration(totalDuration)})</span>
                            <span>${courtPrice.toFixed(2)}</span>
                          </div>
                          {selectedEquipment.length > 0 && (
                            <>
                              {selectedEquipment.map(item => (
                                <div key={item.equipmentId} className="flex justify-between text-sm text-muted-foreground">
                                  <span>{item.name} × {item.quantity}</span>
                                  <span>${(item.quantity * item.pricePerUnit).toFixed(2)}</span>
                                </div>
                              ))}
                            </>
                          )}
                          <div className="flex justify-between text-lg font-bold text-primary pt-1">
                            <span>Total</span>
                            <span>${totalPrice.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Photo Gallery (Desktop only) */}
          <div className="hidden lg:block">
            <div className="sticky top-24 space-y-4">
              {photos.length > 0 ? (
                <>
                  {/* Main Photo */}
                  <div 
                    className="aspect-square rounded-xl overflow-hidden bg-muted cursor-pointer relative group"
                    onClick={() => setShowGallery(true)}
                  >
                    <img 
                      src={photos[currentImageIndex]} 
                      alt={court.name}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 px-4 py-2 rounded-full flex items-center gap-2">
                        <Expand className="h-4 w-4" />
                        <span className="text-sm font-medium">View photos</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Thumbnail strip */}
                  {photos.length > 1 && (
                    <div className="grid grid-cols-4 gap-2">
                      {photos.slice(0, 4).map((photo, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            setCurrentImageIndex(index);
                            if (index === 3 && photos.length > 4) {
                              setShowGallery(true);
                            }
                          }}
                          className={`aspect-square rounded-lg overflow-hidden relative ${
                            currentImageIndex === index ? "ring-2 ring-primary" : ""
                          }`}
                        >
                          <img 
                            src={photo} 
                            alt={`${court.name} ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {index === 3 && photos.length > 4 && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-medium">
                              +{photos.length - 4}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="aspect-square rounded-xl bg-muted flex items-center justify-center">
                  <SportIcon sport={court.sport_type} className="h-20 w-20 text-muted-foreground" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Fullscreen Gallery Modal */}
        {showGallery && photos.length > 0 && (
          <div className="fixed inset-0 z-50 bg-black flex flex-col">
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

            <div className="flex-1 flex items-center justify-center relative px-4">
              <img 
                src={photos[currentImageIndex]} 
                alt={`${court.name} ${currentImageIndex + 1}`}
                className="max-w-full max-h-full object-contain"
              />

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

        {/* Booking Footer */}
        {selectedSlots.length > 0 && selectedDate && (
          <div 
            className="fixed left-0 right-0 p-4 glass border-t border-border z-40" 
            style={{ 
              bottom: user ? 'calc(4rem + env(safe-area-inset-bottom, 0px))' : 'env(safe-area-inset-bottom, 0px)'
            }}
          >
            <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
              <div>
                <div className="font-semibold">${totalPrice.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">
                  {format(selectedDate, "MMM d")} • {getStartTime()} - {getEndTime()} • {formatDuration(totalDuration)}
                  {selectedEquipment.length > 0 && ` + ${selectedEquipment.length} item${selectedEquipment.length !== 1 ? 's' : ''}`}
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
                <Button 
                  className="gap-2"
                  onClick={() => {
                    localStorage.setItem('redirectAfterAuth', window.location.pathname);
                    localStorage.setItem('pendingBookingState', JSON.stringify({
                      courtId: id,
                      selectedDate: selectedDate?.toISOString(),
                      selectedSlots: selectedSlots,
                      selectedEquipment: selectedEquipment,
                    }));
                    navigate("/auth");
                  }}
                >
                  <LogIn className="h-4 w-4" />
                  Login to Book
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Booking Wizard - only show when NOT in quick game mode */}
        {court && selectedSlots.length > 0 && selectedDate && !isQuickGameMode && (
          <BookingWizard
            open={showGroupModal}
            onOpenChange={setShowGroupModal}
            onConfirm={handleBookingConfirm}
            sportType={court.sport_type}
            courtPrice={courtPrice}
            dayOfWeek={getDay(selectedDate)}
            startTime={getStartTime()}
            endTime={getEndTime()}
            city={court.venues?.city || ""}
            slotDate={format(selectedDate, "yyyy-MM-dd")}
            courtName={court.name}
            venueName={court.venues?.name || ""}
            venueAddress={court.venues?.address || ""}
            courtRules={(court as any).rules || null}
            equipment={venueEquipment}
            selectedEquipment={selectedEquipment}
            onEquipmentChange={setSelectedEquipment}
            paymentTiming={court.payment_timing}
          />
        )}

        {/* Quick Challenge Wizard - only show when in quick game mode */}
        {court && selectedSlots.length > 0 && selectedDate && isQuickGameMode && quickGameConfig && (
          <QuickChallengeWizard
            open={showQuickChallengeWizard}
            onOpenChange={setShowQuickChallengeWizard}
            onConfirm={handleQuickChallengeConfirm}
            courtPrice={courtPrice}
            startTime={getStartTime()}
            endTime={getEndTime()}
            slotDate={format(selectedDate, "yyyy-MM-dd")}
            courtName={court.name}
            venueName={court.venues?.name || ""}
            venueAddress={court.venues?.address || ""}
            courtRules={(court as any).rules || null}
            equipment={venueEquipment}
            selectedEquipment={selectedEquipment}
            onEquipmentChange={setSelectedEquipment}
            paymentTiming={court.payment_timing}
            sportName={quickGameConfig.sportName}
            gameMode={quickGameConfig.gameMode}
            totalPlayers={quickGameConfig.totalPlayers}
            submitting={booking}
          />
        )}

        {/* Profile Completion Alert Modal */}
        <Dialog open={showProfileAlert} onOpenChange={setShowProfileAlert}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="sr-only">Complete Your Profile</DialogTitle>
            </DialogHeader>
            <ProfileCompletionAlert
              missingFields={profileMissingFields}
              onClose={() => setShowProfileAlert(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Credits Payment Modal */}
        {court && (
          <PaymentMethodDialog
            open={showCreditsModal}
            onOpenChange={setShowCreditsModal}
            userCredits={credits}
            sessionCost={court.hourly_rate + selectedEquipment.reduce((sum, item) => sum + item.quantity * item.pricePerUnit, 0)}
            onSelectPaymentMethod={handleSelectPaymentMethod}
            isLoading={booking}
          />
        )}

        {/* Pay Now/Later Choice Modal */}
        <PaymentTimingChoice
          open={showPaymentTimingChoice}
          onOpenChange={setShowPaymentTimingChoice}
          onChoice={handlePaymentTimingChoice}
          isLoading={booking}
          totalAmount={pendingPaymentAmount}
        />
      </div>
    </Layout>
  );
}
