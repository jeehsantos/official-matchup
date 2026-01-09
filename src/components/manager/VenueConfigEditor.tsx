import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface VenueConfigEditorProps {
  venueId: string;
  onConfigUpdated?: () => void;
}

export function VenueConfigEditor({ venueId, onConfigUpdated }: VenueConfigEditorProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    slot_interval_minutes: 30,
    max_booking_minutes: 120,
  });

  useEffect(() => {
    fetchConfig();
  }, [venueId]);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("venues")
        .select("slot_interval_minutes, max_booking_minutes")
        .eq("id", venueId)
        .single();

      if (error) throw error;
      
      setConfig({
        slot_interval_minutes: data.slot_interval_minutes || 30,
        max_booking_minutes: data.max_booking_minutes || 120,
      });
    } catch (error) {
      console.error("Error fetching venue config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("venues")
        .update({
          slot_interval_minutes: config.slot_interval_minutes,
          max_booking_minutes: config.max_booking_minutes,
        })
        .eq("id", venueId);

      if (error) throw error;

      toast({ title: "Booking settings saved" });
      onConfigUpdated?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Booking Settings
        </CardTitle>
        <CardDescription>
          Configure time slot intervals and maximum booking duration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="slot_interval">Slot Interval (minutes)</Label>
          <p className="text-sm text-muted-foreground mb-2">
            The smallest bookable time unit (e.g., 30 = half-hour slots)
          </p>
          <Input
            id="slot_interval"
            type="number"
            value={config.slot_interval_minutes}
            onChange={(e) => setConfig(prev => ({ 
              ...prev, 
              slot_interval_minutes: parseInt(e.target.value) || 30 
            }))}
            min={15}
            max={60}
            step={15}
          />
        </div>

        <div>
          <Label htmlFor="max_booking">Maximum Booking Duration (minutes)</Label>
          <p className="text-sm text-muted-foreground mb-2">
            The longest continuous booking allowed (e.g., 120 = 2 hours)
          </p>
          <Input
            id="max_booking"
            type="number"
            value={config.max_booking_minutes}
            onChange={(e) => setConfig(prev => ({ 
              ...prev, 
              max_booking_minutes: parseInt(e.target.value) || 120 
            }))}
            min={30}
            max={480}
            step={30}
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
