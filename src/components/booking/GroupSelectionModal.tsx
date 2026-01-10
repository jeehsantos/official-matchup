import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SportIcon, getSportLabel } from "@/components/ui/sport-icon";
import { Loader2, Plus, Users, Calendar, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PaymentTypeSelector } from "@/components/booking/PaymentTypeSelector";
import { SessionTypeSelector, type SessionType } from "@/components/session/SessionTypeSelector";
import type { Database } from "@/integrations/supabase/types";

type Group = Database["public"]["Tables"]["groups"]["Row"];
type SportType = Database["public"]["Enums"]["sport_type"];
type BookingPaymentType = "single" | "split";

interface GroupSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (groupId: string, isNewGroup: boolean, paymentType: BookingPaymentType, sessionType: SessionType) => void;
  sportType: SportType;
  courtPrice: number;
  dayOfWeek: number;
  startTime: string;
  city: string;
  slotDate: string;
  slotStartTime: string;
  slotEndTime: string;
  courtName: string;
}

export function GroupSelectionModal({
  open,
  onOpenChange,
  onConfirm,
  sportType,
  courtPrice,
  dayOfWeek,
  startTime,
  city,
  slotDate,
  slotStartTime,
  slotEndTime,
  courtName,
}: GroupSelectionModalProps) {
  const { user } = useAuth();
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [newGroupName, setNewGroupName] = useState("");
  const [paymentType, setPaymentType] = useState<BookingPaymentType>("single");
  const [sessionType, setSessionType] = useState<SessionType>("casual");

  const isNewGroup = selectedGroupId === "new";

  useEffect(() => {
    if (open && user) {
      fetchUserGroups();
    }
  }, [open, user]);

  useEffect(() => {
    // Reset state when modal opens
    if (open) {
      setSelectedGroupId("");
      setNewGroupName("");
      setPaymentType("single");
      setSessionType("casual");
    }
  }, [open]);

  const fetchUserGroups = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .eq("organizer_id", user.id)
        .eq("is_active", true);

      if (error) throw error;
      setUserGroups(data || []);
      
      // Auto-select if only one group exists
      if (data && data.length === 1) {
        setSelectedGroupId(data[0].id);
      } else if (!data || data.length === 0) {
        setSelectedGroupId("new");
      }
    } catch (error) {
      console.error("Error fetching groups:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (isNewGroup) {
      if (!newGroupName.trim()) return;
      
      setCreating(true);
      try {
        const { data, error } = await supabase
          .from("groups")
          .insert({
            name: newGroupName.trim(),
            organizer_id: user!.id,
            sport_type: sportType,
            city: city,
            default_day_of_week: dayOfWeek,
            default_start_time: startTime,
            weekly_court_price: courtPrice,
            is_public: false,
          })
          .select()
          .single();

        if (error) throw error;
        // Add organizer as group member
        const { error: memberError } = await supabase.from("group_members").insert({
          group_id: data.id,
          user_id: user!.id,
          is_admin: true,
        });

        if (memberError) throw memberError;

        onConfirm(data.id, true, paymentType, sessionType);
      } catch (error: any) {
        console.error("Error creating group:", error);
        toast.error(error?.message ?? "Failed to create group. Please try again.");
      } finally {
        setCreating(false);
      }
    } else {
      if (!selectedGroupId) return;
      onConfirm(selectedGroupId, false, paymentType, sessionType);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { 
      weekday: "long",
      month: "short", 
      day: "numeric" 
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const canConfirm = isNewGroup ? newGroupName.trim().length > 0 : !!selectedGroupId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Confirm Booking</DialogTitle>
          <DialogDescription>
            Select a group for this booking or create a new one
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Booking Summary Card */}
            <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-4">
              <div className="flex items-center gap-3 mb-3">
                <SportIcon sport={sportType} className="h-10 w-10" />
                <div>
                  <h3 className="font-semibold text-lg">{courtName}</h3>
                  <p className="text-sm text-muted-foreground">{getSportLabel(sportType)}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(slotDate)}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{formatTime(slotStartTime)} - {formatTime(slotEndTime)}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{city}</span>
                </div>
                <div className="flex items-center gap-2 font-semibold text-primary">
                  <span className="text-lg">${courtPrice}</span>
                </div>
              </div>
            </div>

            {/* Group Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Select Group</Label>
              <Select
                value={selectedGroupId}
                onValueChange={setSelectedGroupId}
              >
                <SelectTrigger className="w-full h-12">
                  <SelectValue placeholder="Choose a group..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border shadow-lg">
                  {userGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id} className="py-3">
                      <div className="flex items-center gap-2">
                        <SportIcon sport={group.sport_type} className="h-4 w-4" />
                        <span>{group.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                  <SelectItem value="new" className="py-3">
                    <div className="flex items-center gap-2 text-primary">
                      <Plus className="h-4 w-4" />
                      <span className="font-medium">Create New Group</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* New Group Name Input */}
            {isNewGroup && (
              <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                <Label htmlFor="group-name" className="text-sm font-medium">
                  New Group Name
                </Label>
                <Input
                  id="group-name"
                  placeholder="e.g., Wednesday Legends"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="h-12"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  You'll be the organizer. Invite players after booking.
                </p>
              </div>
            )}

            {/* Session Type Selection */}
            <SessionTypeSelector
              value={sessionType}
              onChange={setSessionType}
            />

            {/* Payment Type Selection */}
            <PaymentTypeSelector
              paymentType={paymentType}
              onPaymentTypeChange={setPaymentType}
              courtPrice={courtPrice}
            />

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 h-12"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-12 font-semibold"
                onClick={handleConfirm}
                disabled={creating || !canConfirm}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4 mr-2" />
                    Confirm Booking
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}