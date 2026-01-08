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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SportIcon, getSportLabel } from "@/components/ui/sport-icon";
import { Loader2, Plus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Database } from "@/integrations/supabase/types";

type Group = Database["public"]["Tables"]["groups"]["Row"];
type SportType = Database["public"]["Enums"]["sport_type"];

interface GroupSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (groupId: string, isNewGroup: boolean) => void;
  sportType: SportType;
  courtPrice: number;
  dayOfWeek: number;
  startTime: string;
  city: string;
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
}: GroupSelectionModalProps) {
  const { user } = useAuth();
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [createNewGroup, setCreateNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  useEffect(() => {
    if (open && user) {
      fetchUserGroups();
    }
  }, [open, user]);

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
      
      // If no groups, auto-select create new
      if (!data || data.length === 0) {
        setCreateNewGroup(true);
      }
    } catch (error) {
      console.error("Error fetching groups:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (createNewGroup) {
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
        await supabase.from("group_members").insert({
          group_id: data.id,
          user_id: user!.id,
          is_admin: true,
        });
        
        onConfirm(data.id, true);
      } catch (error) {
        console.error("Error creating group:", error);
      } finally {
        setCreating(false);
      }
    } else {
      if (!selectedGroupId) return;
      onConfirm(selectedGroupId, false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select a Group</DialogTitle>
          <DialogDescription>
            Choose which group this booking is for, or create a new one.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {userGroups.length > 0 && (
              <RadioGroup
                value={createNewGroup ? "new" : selectedGroupId}
                onValueChange={(value) => {
                  if (value === "new") {
                    setCreateNewGroup(true);
                    setSelectedGroupId("");
                  } else {
                    setCreateNewGroup(false);
                    setSelectedGroupId(value);
                  }
                }}
              >
                <div className="space-y-2">
                  {userGroups.map((group) => (
                    <div
                      key={group.id}
                      className={`flex items-center space-x-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                        selectedGroupId === group.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                      onClick={() => {
                        setSelectedGroupId(group.id);
                        setCreateNewGroup(false);
                      }}
                    >
                      <RadioGroupItem value={group.id} id={group.id} />
                      <div className="flex items-center gap-3 flex-1">
                        <SportIcon sport={group.sport_type} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{group.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {getSportLabel(group.sport_type)} • {group.city}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Create new group option */}
                  <div
                    className={`flex items-center space-x-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                      createNewGroup
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                    onClick={() => {
                      setCreateNewGroup(true);
                      setSelectedGroupId("");
                    }}
                  >
                    <RadioGroupItem value="new" id="new-group" />
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Plus className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Create New Group</p>
                        <p className="text-sm text-muted-foreground">
                          Start a new group for this booking
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </RadioGroup>
            )}

            {(createNewGroup || userGroups.length === 0) && (
              <div className="space-y-3 pt-2">
                <Label htmlFor="group-name">Group Name</Label>
                <Input
                  id="group-name"
                  placeholder="e.g., Wednesday Legends"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  You'll be the organizer of this group. You can invite players and manage sessions.
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirm}
                disabled={
                  creating ||
                  (createNewGroup && !newGroupName.trim()) ||
                  (!createNewGroup && !selectedGroupId)
                }
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  "Confirm Booking"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
