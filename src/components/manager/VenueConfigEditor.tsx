import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface VenueConfigEditorProps {
  venueId: string;
  onConfigUpdated?: () => void;
}

export function VenueConfigEditor({ venueId, onConfigUpdated }: VenueConfigEditorProps) {
  const { t } = useTranslation("manager");
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

      toast({ title: t("bookingConfig.saved") });
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
      <Card className="border-border/40 md:border-border bg-transparent md:bg-card shadow-none md:shadow-sm">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/40 md:border-border bg-transparent md:bg-card shadow-none md:shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          {t("bookingConfig.title")}
        </CardTitle>
        <CardDescription>
          {t("bookingConfig.subtitle")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div>
          <Label htmlFor="slot_interval">{t("bookingConfig.slotInterval")}</Label>
          <p className="text-sm text-muted-foreground mb-2">
            {t("bookingConfig.slotIntervalDesc")}
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
          <Label htmlFor="max_booking">{t("bookingConfig.maxBooking")}</Label>
          <p className="text-sm text-muted-foreground mb-2">
            {t("bookingConfig.maxBookingDesc")}
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
              {t("weeklySchedule.saving")}
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {t("bookingConfig.saved").replace(" saved", "")}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
