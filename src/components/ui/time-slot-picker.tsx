import { Button } from "@/components/ui/button";
import { Sun, Sunset, Moon, Clock } from "lucide-react";
import { useMemo } from "react";

interface TimeSlot {
  start_time: string;
  available_durations: number[];
}

interface TimeSlotPickerProps {
  slots: TimeSlot[];
  selectedSlots: string[];
  onToggle: (time: string) => void;
  intervalMinutes: number;
  selectedDate?: Date;
}

// Convert time string to minutes for comparison
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

// Get hour from time string
const getHour = (time: string): number => {
  return parseInt(time.split(":")[0], 10);
};

export function TimeSlotPicker({
  slots,
  selectedSlots,
  onToggle,
  intervalMinutes,
  selectedDate,
}: TimeSlotPickerProps) {
  // Filter out past slots if the selected date is today
  const filteredSlots = useMemo(() => {
    if (!selectedDate) return slots;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const selected = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    
    // If selected date is not today, show all slots
    if (selected.getTime() !== today.getTime()) return slots;
    
    // Filter out past slots for today
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return slots.filter(slot => timeToMinutes(slot.start_time) > currentMinutes);
  }, [slots, selectedDate]);
  // Group slots by time of day
  const morningSlots = filteredSlots.filter((s) => getHour(s.start_time) < 12);
  const afternoonSlots = filteredSlots.filter(
    (s) => getHour(s.start_time) >= 12 && getHour(s.start_time) < 17
  );
  const eveningSlots = filteredSlots.filter((s) => getHour(s.start_time) >= 17);

  // Check if a slot is in the selected range (for visual continuity)
  const isSlotInRange = (slotTime: string): boolean => {
    const normalizedTime = slotTime.slice(0, 5);
    if (selectedSlots.length === 0) return false;
    if (selectedSlots.includes(normalizedTime)) return true;

    const sorted = [...selectedSlots].sort(
      (a, b) => timeToMinutes(a) - timeToMinutes(b)
    );
    const first = timeToMinutes(sorted[0]);
    const last = timeToMinutes(sorted[sorted.length - 1]);
    const current = timeToMinutes(normalizedTime);

    return current >= first && current <= last;
  };

  // Check if slot is the first or last in selection
  const isFirstSlot = (slotTime: string): boolean => {
    const normalizedTime = slotTime.slice(0, 5);
    if (selectedSlots.length === 0) return false;
    const sorted = [...selectedSlots].sort(
      (a, b) => timeToMinutes(a) - timeToMinutes(b)
    );
    return sorted[0] === normalizedTime;
  };

  const isLastSlot = (slotTime: string): boolean => {
    const normalizedTime = slotTime.slice(0, 5);
    if (selectedSlots.length === 0) return false;
    const sorted = [...selectedSlots].sort(
      (a, b) => timeToMinutes(a) - timeToMinutes(b)
    );
    return sorted[sorted.length - 1] === normalizedTime;
  };

  const renderTimeGroup = (
    groupSlots: TimeSlot[],
    icon: React.ReactNode,
    label: string,
    iconColor: string
  ) => {
    if (groupSlots.length === 0) return null;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-md ${iconColor}`}>{icon}</div>
          <span className="text-sm font-medium text-muted-foreground">
            {label}
          </span>
          <span className="text-xs text-muted-foreground/70">
            ({groupSlots.length} slots)
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {groupSlots.map((slot) => {
            const slotTime = slot.start_time.slice(0, 5);
            const isSelected = selectedSlots.includes(slotTime);
            const inRange = isSlotInRange(slot.start_time);
            const isFirst = isFirstSlot(slot.start_time);
            const isLast = isLastSlot(slot.start_time);

            return (
              <Button
                key={slot.start_time}
                variant={isSelected ? "default" : inRange ? "secondary" : "outline"}
                size="sm"
                className={`
                  min-w-[60px] h-10 font-medium transition-all
                  ${isSelected ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}
                  ${isFirst ? "rounded-l-lg" : ""}
                  ${isLast ? "rounded-r-lg" : ""}
                  ${isSelected && !isFirst && !isLast ? "rounded-none" : ""}
                `}
                onClick={() => onToggle(slot.start_time)}
              >
                {slotTime}
              </Button>
            );
          })}
        </div>
      </div>
    );
  };

  if (filteredSlots.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>{slots.length > 0 ? "No more available slots for today" : "No available slots for this date"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderTimeGroup(
        morningSlots,
        <Sun className="h-4 w-4 text-amber-500" />,
        "Morning",
        "bg-amber-500/10"
      )}
      {renderTimeGroup(
        afternoonSlots,
        <Sunset className="h-4 w-4 text-orange-500" />,
        "Afternoon",
        "bg-orange-500/10"
      )}
      {renderTimeGroup(
        eveningSlots,
        <Moon className="h-4 w-4 text-indigo-500" />,
        "Evening",
        "bg-indigo-500/10"
      )}
    </div>
  );
}
