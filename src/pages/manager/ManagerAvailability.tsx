import { useState, useEffect } from "react";
import { ManagerLayout } from "@/components/layout/ManagerLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { SportIcon } from "@/components/ui/sport-icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Plus, 
  Calendar as CalendarIcon,
  Clock,
  Trash2,
  Loader2
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
  venues: Venue;
}

export default function ManagerAvailability() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [courts, setCourts] = useState<CourtWithVenue[]>([]);
  const [selectedCourt, setSelectedCourt] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [newSlot, setNewSlot] = useState({
    startTime: "09:00",
    endTime: "10:00",
  });

  useEffect(() => {
    if (user) {
      fetchCourts();
    }
  }, [user]);

  useEffect(() => {
    if (selectedCourt) {
      fetchAvailability();
    }
  }, [selectedCourt]);

  const fetchCourts = async () => {
    try {
      // First get venues owned by user
      const { data: venues, error: venuesError } = await supabase
        .from("venues")
        .select("id")
        .eq("owner_id", user?.id);

      if (venuesError) throw venuesError;
      
      if (venues && venues.length > 0) {
        const venueIds = venues.map(v => v.id);
        
        const { data: courtsData, error: courtsError } = await supabase
          .from("courts")
          .select(`
            *,
            venues (*)
          `)
          .in("venue_id", venueIds)
          .eq("is_active", true);

        if (courtsError) throw courtsError;
        
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

  const fetchAvailability = async () => {
    if (!selectedCourt) return;
    
    try {
      const { data, error } = await supabase
        .from("court_availability")
        .select("*")
        .eq("court_id", selectedCourt)
        .order("available_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;
      setAvailability(data || []);
    } catch (error) {
      console.error("Error fetching availability:", error);
    }
  };

  const handleAddSlot = async () => {
    if (!selectedCourt || !selectedDate) return;
    
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("court_availability")
        .insert({
          court_id: selectedCourt,
          available_date: format(selectedDate, "yyyy-MM-dd"),
          start_time: newSlot.startTime,
          end_time: newSlot.endTime,
        });

      if (error) throw error;
      
      toast({ title: "Availability slot added" });
      setDialogOpen(false);
      fetchAvailability();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add slot",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    try {
      const { error } = await supabase
        .from("court_availability")
        .delete()
        .eq("id", slotId);

      if (error) throw error;
      
      toast({ title: "Slot deleted" });
      fetchAvailability();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete slot",
        variant: "destructive",
      });
    }
  };

  const slotsForSelectedDate = selectedDate
    ? availability.filter(slot => isSameDay(new Date(slot.available_date), selectedDate))
    : [];

  const datesWithSlots = [...new Set(availability.map(slot => slot.available_date))];

  const selectedCourtData = courts.find(c => c.id === selectedCourt);

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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Availability</h1>
            <p className="text-muted-foreground">Publish available time slots for booking</p>
          </div>
        </div>

        {courts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">No courts available</h3>
              <p className="text-muted-foreground">
                Add courts to your venues first to start publishing availability.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Court Selection & Calendar */}
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Select Court</CardTitle>
                </CardHeader>
                <CardContent>
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
                            <span className="text-muted-foreground">
                              - {court.venues.name}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Select Date</CardTitle>
                </CardHeader>
                <CardContent>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < new Date()}
                    modifiers={{
                      hasSlots: datesWithSlots.map(d => new Date(d)),
                    }}
                    modifiersStyles={{
                      hasSlots: { backgroundColor: "hsl(var(--primary) / 0.1)" }
                    }}
                    className="rounded-md"
                  />
                </CardContent>
              </Card>
            </div>

            {/* Slots for Selected Date */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : "Select a date"}
                    </CardTitle>
                    {selectedCourtData && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedCourtData.name} • ${selectedCourtData.hourly_rate}/hr
                      </p>
                    )}
                  </div>
                  
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-1" disabled={!selectedDate}>
                        <Plus className="h-4 w-4" />
                        Add Slot
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Availability Slot</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div>
                          <Label>Date</Label>
                          <p className="text-sm text-muted-foreground">
                            {selectedDate ? format(selectedDate, "MMMM d, yyyy") : "-"}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="startTime">Start Time</Label>
                            <Input
                              id="startTime"
                              type="time"
                              value={newSlot.startTime}
                              onChange={(e) => setNewSlot({ ...newSlot, startTime: e.target.value })}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="endTime">End Time</Label>
                            <Input
                              id="endTime"
                              type="time"
                              value={newSlot.endTime}
                              onChange={(e) => setNewSlot({ ...newSlot, endTime: e.target.value })}
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <Button 
                          onClick={handleAddSlot} 
                          disabled={submitting} 
                          className="w-full"
                        >
                          {submitting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            "Add Slot"
                          )}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                
                <CardContent>
                  {!selectedDate ? (
                    <p className="text-muted-foreground text-center py-8">
                      Select a date to view and manage availability.
                    </p>
                  ) : slotsForSelectedDate.length === 0 ? (
                    <div className="text-center py-8">
                      <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">
                        No slots published for this date.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {slotsForSelectedDate.map((slot) => (
                        <div 
                          key={slot.id} 
                          className="flex items-center justify-between p-3 rounded-lg border border-border"
                        >
                          <div className="flex items-center gap-3">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                            </span>
                            {slot.is_booked ? (
                              <Badge variant="secondary">Booked</Badge>
                            ) : (
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                Available
                              </Badge>
                            )}
                          </div>
                          {!slot.is_booked && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSlot(slot.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}
