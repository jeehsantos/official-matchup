import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Loader2, CalendarDays, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RescheduleBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  courtId: string;
  venueId: string;
  currentDate: string;
  currentStartTime: string;
  currentEndTime: string;
  onSuccess: () => void;
}

interface AvailableSlot {
  start_time: string;
  status: string;
  available_durations: number[];
}

export function RescheduleBookingDialog({
  open,
  onOpenChange,
  bookingId,
  courtId,
  venueId,
  currentDate,
  currentStartTime,
  currentEndTime,
  onSuccess,
}: RescheduleBookingDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Calculate current duration in minutes
  const [csh, csm] = currentStartTime.split(":").map(Number);
  const [ceh, cem] = currentEndTime.split(":").map(Number);
  const currentDuration = (ceh * 60 + cem) - (csh * 60 + csm);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedDate(undefined);
      setSlots([]);
      setSelectedSlot(null);
    }
  }, [open]);

  // Fetch availability when date changes
  useEffect(() => {
    if (!selectedDate || !open) return;

    const fetchAvailability = async () => {
      setLoadingSlots(true);
      setSelectedSlot(null);
      try {
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        const { data, error } = await supabase.functions.invoke("get-availability", {
          body: { venueId, courtId, date: dateStr },
        });

        if (error) throw error;

        // Filter slots that are AVAILABLE and support the current duration
        const availableSlots = (data?.slots || []).filter(
          (s: AvailableSlot) =>
            s.status === "AVAILABLE" &&
            s.available_durations.includes(currentDuration)
        );

        // If same date as current, exclude the current slot time
        const filtered =
          dateStr === currentDate
            ? availableSlots.filter(
                (s: AvailableSlot) => s.start_time !== currentStartTime.slice(0, 5)
              )
            : availableSlots;

        setSlots(filtered);
      } catch (err) {
        console.error("Failed to fetch availability:", err);
        toast.error("Failed to load available slots");
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchAvailability();
  }, [selectedDate, open, venueId, courtId, currentDuration, currentDate, currentStartTime]);

  const handleReschedule = async () => {
    if (!selectedDate || !selectedSlot) return;

    setSubmitting(true);
    try {
      const newDate = format(selectedDate, "yyyy-MM-dd");
      const [sh, sm] = selectedSlot.split(":").map(Number);
      const endMinutes = sh * 60 + sm + currentDuration;
      const endH = Math.floor(endMinutes / 60);
      const endM = endMinutes % 60;
      const newEndTime = `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}:00`;
      const newStartTime = `${selectedSlot}:00`;

      const { data, error } = await supabase.functions.invoke("reschedule-booking", {
        body: {
          booking_id: bookingId,
          new_date: newDate,
          new_start_time: newStartTime,
          new_end_time: newEndTime,
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.message || data.error);
        return;
      }

      toast.success("Booking rescheduled successfully");
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      console.error("Reschedule error:", err);
      toast.error("Failed to reschedule booking");
    } finally {
      setSubmitting(false);
    }
  };

  const formatSlotTime = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Reschedule Booking
          </DialogTitle>
          <DialogDescription>
            Select a new date and time. The booking stays paid — no additional charge.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current booking info */}
          <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-sm">
            <p className="text-muted-foreground mb-1">Current booking:</p>
            <p className="font-medium">
              {format(new Date(currentDate + "T00:00:00"), "EEE, MMM d, yyyy")} •{" "}
              {formatSlotTime(currentStartTime.slice(0, 5))} – {formatSlotTime(currentEndTime.slice(0, 5))}
              <span className="text-muted-foreground ml-1">({currentDuration}min)</span>
            </p>
          </div>

          {/* Date picker */}
          <div>
            <p className="text-sm font-medium mb-2">Pick a new date</p>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              className={cn("p-3 pointer-events-auto rounded-md border")}
            />
          </div>

          {/* Time slots */}
          {selectedDate && (
            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                Available times for {format(selectedDate, "MMM d")}
              </p>

              {loadingSlots ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No available slots for this date
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto">
                  {slots.map((slot) => {
                    const slotTime = slot.start_time.slice(0, 5);
                    const isSelected = selectedSlot === slotTime;
                    return (
                      <Button
                        key={slotTime}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "min-w-[70px] h-10 font-medium",
                          isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                        )}
                        onClick={() => setSelectedSlot(slotTime)}
                      >
                        {formatSlotTime(slotTime)}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleReschedule}
            disabled={!selectedDate || !selectedSlot || submitting}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Confirm Reschedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
