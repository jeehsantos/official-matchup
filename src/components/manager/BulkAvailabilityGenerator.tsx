import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Wand2, 
  CalendarIcon, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, eachDayOfInterval, getDay, isBefore, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Availability = Database["public"]["Tables"]["court_availability"]["Row"];

interface BulkAvailabilityGeneratorProps {
  courtId: string;
  existingAvailability: Availability[];
  onGenerated: () => void;
}

const DAYS_OF_WEEK = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];

const SLOT_DURATIONS = [
  { label: "30 mins", value: 30 },
  { label: "45 mins", value: 45 },
  { label: "60 mins", value: 60 },
  { label: "90 mins", value: 90 },
  { label: "120 mins", value: 120 },
];

interface GeneratedSlot {
  date: string;
  startTime: string;
  endTime: string;
  hasConflict: boolean;
  conflictType?: "available" | "booked";
}

export function BulkAvailabilityGenerator({ 
  courtId, 
  existingAvailability,
  onGenerated 
}: BulkAvailabilityGeneratorProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Template settings
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [slotDuration, setSlotDuration] = useState(60);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri

  // Date range
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  // Conflict handling
  const [skipConflicts, setSkipConflicts] = useState(true);

  const toggleDay = (day: number) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  // Generate time slots from start/end time and duration
  const generateTimeSlots = (start: string, end: string, duration: number): { startTime: string; endTime: string }[] => {
    const slots: { startTime: string; endTime: string }[] = [];
    
    const [startHour, startMin] = start.split(":").map(Number);
    const [endHour, endMin] = end.split(":").map(Number);
    
    let currentMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    while (currentMinutes + duration <= endMinutes) {
      const slotStartHour = Math.floor(currentMinutes / 60);
      const slotStartMin = currentMinutes % 60;
      const slotEndMinutes = currentMinutes + duration;
      const slotEndHour = Math.floor(slotEndMinutes / 60);
      const slotEndMin = slotEndMinutes % 60;
      
      slots.push({
        startTime: `${slotStartHour.toString().padStart(2, "0")}:${slotStartMin.toString().padStart(2, "0")}`,
        endTime: `${slotEndHour.toString().padStart(2, "0")}:${slotEndMin.toString().padStart(2, "0")}`,
      });
      
      currentMinutes += duration;
    }
    
    return slots;
  };

  // Check if a slot conflicts with existing availability
  const checkConflict = (date: string, slotStart: string, slotEnd: string): { hasConflict: boolean; conflictType?: "available" | "booked" } => {
    const conflict = existingAvailability.find(existing => {
      if (existing.available_date !== date) return false;
      
      const existingStart = existing.start_time.slice(0, 5);
      const existingEnd = existing.end_time.slice(0, 5);
      
      // Check for overlap
      return !(slotEnd <= existingStart || slotStart >= existingEnd);
    });
    
    if (!conflict) return { hasConflict: false };
    
    return {
      hasConflict: true,
      conflictType: conflict.is_booked ? "booked" : "available",
    };
  };

  // Generate preview of all slots
  const generatedSlots = useMemo<GeneratedSlot[]>(() => {
    if (!dateRange.from || !dateRange.to) return [];
    
    const slots: GeneratedSlot[] = [];
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    const timeSlots = generateTimeSlots(startTime, endTime, slotDuration);
    
    for (const day of days) {
      // Skip past dates
      if (isBefore(day, startOfDay(new Date()))) continue;
      
      // Check if day of week is selected (getDay returns 0 for Sunday)
      const dayOfWeek = getDay(day);
      if (!selectedDays.includes(dayOfWeek)) continue;
      
      const dateStr = format(day, "yyyy-MM-dd");
      
      for (const timeSlot of timeSlots) {
        const conflict = checkConflict(dateStr, timeSlot.startTime, timeSlot.endTime);
        slots.push({
          date: dateStr,
          startTime: timeSlot.startTime,
          endTime: timeSlot.endTime,
          ...conflict,
        });
      }
    }
    
    return slots;
  }, [dateRange, selectedDays, startTime, endTime, slotDuration, existingAvailability]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = generatedSlots.length;
    const conflicts = generatedSlots.filter(s => s.hasConflict).length;
    const bookedConflicts = generatedSlots.filter(s => s.conflictType === "booked").length;
    const availableConflicts = generatedSlots.filter(s => s.conflictType === "available").length;
    
    const toCreate = skipConflicts 
      ? total - conflicts 
      : total - bookedConflicts; // Never overwrite booked slots
    
    return { total, conflicts, bookedConflicts, availableConflicts, toCreate };
  }, [generatedSlots, skipConflicts]);

  const handleGenerate = async () => {
    if (stats.toCreate === 0) {
      toast({
        title: "No slots to create",
        description: "All generated slots conflict with existing availability.",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    
    try {
      // Generate a unique template ID for this batch
      const templateId = crypto.randomUUID();
      
      // Filter slots based on conflict handling
      const slotsToCreate = generatedSlots.filter(slot => {
        if (!slot.hasConflict) return true;
        if (slot.conflictType === "booked") return false; // Never overwrite booked
        return !skipConflicts; // If skip conflicts is off, include available conflicts
      });

      // If overwriting, delete existing non-booked slots first
      if (!skipConflicts) {
        const datesToUpdate = [...new Set(slotsToCreate.filter(s => s.hasConflict).map(s => s.date))];
        
        for (const date of datesToUpdate) {
          const slotsOnDate = slotsToCreate.filter(s => s.date === date && s.hasConflict);
          
          for (const slot of slotsOnDate) {
            await supabase
              .from("court_availability")
              .delete()
              .eq("court_id", courtId)
              .eq("available_date", slot.date)
              .gte("start_time", slot.startTime)
              .lte("end_time", slot.endTime)
              .eq("is_booked", false);
          }
        }
      }

      // Insert new slots in batches of 100
      const batchSize = 100;
      for (let i = 0; i < slotsToCreate.length; i += batchSize) {
        const batch = slotsToCreate.slice(i, i + batchSize).map(slot => ({
          court_id: courtId,
          available_date: slot.date,
          start_time: slot.startTime,
          end_time: slot.endTime,
          template_id: templateId,
        }));

        const { error } = await supabase
          .from("court_availability")
          .insert(batch);

        if (error) throw error;
      }

      toast({
        title: "Availability generated!",
        description: `Successfully created ${slotsToCreate.length} time slots.`,
      });
      
      setDialogOpen(false);
      setShowPreview(false);
      onGenerated();
      
      // Reset form
      setDateRange({ from: undefined, to: undefined });
      
    } catch (error: any) {
      console.error("Error generating availability:", error);
      toast({
        title: "Error generating availability",
        description: error.message || "Failed to create slots",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const resetAndClose = () => {
    setDialogOpen(false);
    setShowPreview(false);
    setDateRange({ from: undefined, to: undefined });
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => {
      if (!open) resetAndClose();
      else setDialogOpen(true);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Wand2 className="h-4 w-4" />
          Bulk Generate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Bulk Availability Generator
          </DialogTitle>
        </DialogHeader>
        
        {!showPreview ? (
          <div className="space-y-6 pt-4">
            {/* Template Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Daily Schedule Template</CardTitle>
                <CardDescription>Define your standard operating hours</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="bulk-start">Opening Time</Label>
                    <Input
                      id="bulk-start"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bulk-end">Closing Time</Label>
                    <Input
                      id="bulk-end"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Slot Duration</Label>
                  <Select 
                    value={slotDuration.toString()} 
                    onValueChange={(v) => setSlotDuration(Number(v))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SLOT_DURATIONS.map(d => (
                        <SelectItem key={d.value} value={d.value.toString()}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Days of Week */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Days of Week</CardTitle>
                <CardDescription>Select which days to apply this schedule</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map(day => (
                    <Button
                      key={day.value}
                      type="button"
                      variant={selectedDays.includes(day.value) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleDay(day.value)}
                      className="w-12"
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Date Range */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Date Range</CardTitle>
                <CardDescription>Select the period to generate availability</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal mt-1",
                            !dateRange.from && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange.from ? format(dateRange.from, "PPP") : "Select date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateRange.from}
                          onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                          disabled={(date) => isBefore(date, startOfDay(new Date()))}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal mt-1",
                            !dateRange.to && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange.to ? format(dateRange.to, "PPP") : "Select date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateRange.to}
                          onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                          disabled={(date) => 
                            isBefore(date, startOfDay(new Date())) ||
                            (dateRange.from ? isBefore(date, dateRange.from) : false)
                          }
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Conflict Handling */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Conflict Handling</CardTitle>
                <CardDescription>What to do when slots overlap with existing availability</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Skip conflicts</Label>
                    <p className="text-sm text-muted-foreground">
                      {skipConflicts 
                        ? "New slots will be skipped if they overlap with existing ones" 
                        : "Existing available (non-booked) slots will be overwritten"
                      }
                    </p>
                  </div>
                  <Switch
                    checked={skipConflicts}
                    onCheckedChange={setSkipConflicts}
                  />
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Info className="h-4 w-4" />
                  <span>Confirmed bookings are never overwritten</span>
                </div>
              </CardContent>
            </Card>

            {/* Preview Button */}
            <Button 
              className="w-full" 
              size="lg"
              onClick={() => setShowPreview(true)}
              disabled={!dateRange.from || !dateRange.to || selectedDays.length === 0}
            >
              Preview & Generate
            </Button>
          </div>
        ) : (
          <div className="space-y-6 pt-4">
            {/* Preview Stats */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Generation Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-3xl font-bold text-primary">{stats.toCreate}</div>
                    <div className="text-sm text-muted-foreground">Slots to Create</div>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-3xl font-bold">{stats.total}</div>
                    <div className="text-sm text-muted-foreground">Total Generated</div>
                  </div>
                </div>

                {stats.conflicts > 0 && (
                  <div className="space-y-2">
                    {stats.bookedConflicts > 0 && (
                      <div className="flex items-center gap-2 text-sm p-2 bg-destructive/10 rounded-lg">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span>{stats.bookedConflicts} slots skipped (already booked)</span>
                      </div>
                    )}
                    {stats.availableConflicts > 0 && (
                      <div className="flex items-center gap-2 text-sm p-2 bg-yellow-500/10 rounded-lg">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <span>
                          {stats.availableConflicts} slots {skipConflicts ? "skipped" : "will overwrite"} (existing availability)
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Summary */}
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Date Range</span>
                    <span>{dateRange.from && dateRange.to && `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d, yyyy")}`}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Schedule</span>
                    <span>{startTime} - {endTime}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Slot Duration</span>
                    <span>{slotDuration} mins</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Days</span>
                    <div className="flex gap-1">
                      {DAYS_OF_WEEK.filter(d => selectedDays.includes(d.value)).map(d => (
                        <Badge key={d.value} variant="secondary" className="text-xs">
                          {d.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Slot List Preview (first 20) */}
            {generatedSlots.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">
                    Sample Slots {generatedSlots.length > 20 && `(showing 20 of ${generatedSlots.length})`}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {generatedSlots.slice(0, 20).map((slot, idx) => (
                      <div 
                        key={idx}
                        className={cn(
                          "flex items-center justify-between text-sm p-2 rounded",
                          slot.hasConflict 
                            ? slot.conflictType === "booked"
                              ? "bg-destructive/10 text-destructive line-through"
                              : skipConflicts 
                                ? "bg-yellow-500/10 text-yellow-700 line-through"
                                : "bg-yellow-500/10"
                            : "bg-muted"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          <span>{format(new Date(slot.date), "EEE, MMM d")}</span>
                        </div>
                        <span>{slot.startTime} - {slot.endTime}</span>
                        {slot.hasConflict && (
                          <Badge 
                            variant={slot.conflictType === "booked" ? "destructive" : "outline"}
                            className="text-xs"
                          >
                            {slot.conflictType === "booked" ? "Booked" : "Exists"}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                Back to Edit
              </Button>
              <Button 
                onClick={handleGenerate} 
                disabled={generating || stats.toCreate === 0}
                className="gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Create {stats.toCreate} Slots
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
