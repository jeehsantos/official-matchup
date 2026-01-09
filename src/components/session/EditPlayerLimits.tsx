import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Pencil, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface EditPlayerLimitsProps {
  sessionId: string;
  currentMin: number;
  currentMax: number;
  courtPrice: number;
  onUpdate: () => void;
}

export function EditPlayerLimits({
  sessionId,
  currentMin,
  currentMax,
  courtPrice,
  onUpdate,
}: EditPlayerLimitsProps) {
  const [open, setOpen] = useState(false);
  const [minPlayers, setMinPlayers] = useState(currentMin);
  const [maxPlayers, setMaxPlayers] = useState(currentMax);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const pricePerPlayer = courtPrice / minPlayers;

  const handleSave = async () => {
    if (minPlayers > maxPlayers) {
      toast({
        title: "Invalid values",
        description: "Minimum players cannot be greater than maximum players.",
        variant: "destructive",
      });
      return;
    }

    if (minPlayers < 2) {
      toast({
        title: "Invalid values",
        description: "Minimum players must be at least 2.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("sessions")
        .update({
          min_players: minPlayers,
          max_players: maxPlayers,
        })
        .eq("id", sessionId);

      if (error) throw error;

      toast({
        title: "Player limits updated",
        description: `New price per player: $${pricePerPlayer.toFixed(2)}`,
      });
      setOpen(false);
      onUpdate();
    } catch (error) {
      console.error("Error updating player limits:", error);
      toast({
        title: "Error",
        description: "Failed to update player limits.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="mt-4 w-full">
          <Pencil className="h-4 w-4 mr-2" />
          Edit Player Limits
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Edit Player Limits
          </DialogTitle>
          <DialogDescription>
            Adjust the minimum and maximum number of players for this session.
            Price per player is automatically calculated.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min-players">Min Players</Label>
              <Input
                id="min-players"
                type="number"
                min={2}
                max={maxPlayers}
                value={minPlayers}
                onChange={(e) => setMinPlayers(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-players">Max Players</Label>
              <Input
                id="max-players"
                type="number"
                min={minPlayers}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Court Price:</span>
              <span className="font-semibold">${courtPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm text-muted-foreground">Price per Player:</span>
              <span className="font-bold text-primary text-lg">
                ${pricePerPlayer.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
