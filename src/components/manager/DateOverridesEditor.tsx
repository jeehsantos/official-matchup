import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, CalendarX, CalendarClock, Clock, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, isBefore, parseISO } from "date-fns";

interface DateOverride {
  id: string;
  venue_id: string;
  start_date: string;
  end_date: string | null;
  is_closed: boolean;
  custom_start_time: string | null;
  custom_end_time: string | null;
  note: string | null;
}

interface DateOverridesEditorProps {
  venueId: string;
  onOverridesUpdated?: () => void;
}

export function DateOverridesEditor({ venueId, onOverridesUpdated }: DateOverridesEditorProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [overrides, setOverrides] = useState<DateOverride[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const [newOverride, setNewOverride] = useState({
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: "",
    is_closed: true,
    custom_start_time: "",
    custom_end_time: "",
    note: "",
  });

  useEffect(() => {
    fetchOverrides();
  }, [venueId]);

  const fetchOverrides = async () => {
    try {
      const { data, error } = await supabase
        .from("venue_date_overrides")
        .select("*")
        .eq("venue_id", venueId)
        .order("start_date", { ascending: true });

      if (error) throw error;
      setOverrides(data || []);
    } catch (error) {
      console.error("Error fetching overrides:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddOverride = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("venue_date_overrides")
        .insert({
          venue_id: venueId,
          start_date: newOverride.start_date,
          end_date: newOverride.end_date || null,
          is_closed: newOverride.is_closed,
          custom_start_time: newOverride.is_closed ? null : (newOverride.custom_start_time || null),
          custom_end_time: newOverride.is_closed ? null : (newOverride.custom_end_time || null),
          note: newOverride.note || null,
        });

      if (error) throw error;

      toast({ title: "Exception added" });
      setDialogOpen(false);
      setNewOverride({
        start_date: format(new Date(), "yyyy-MM-dd"),
        end_date: "",
        is_closed: true,
        custom_start_time: "",
        custom_end_time: "",
        note: "",
      });
      fetchOverrides();
      onOverridesUpdated?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add exception",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOverride = async (id: string) => {
    try {
      const { error } = await supabase
        .from("venue_date_overrides")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({ title: "Exception removed" });
      fetchOverrides();
      onOverridesUpdated?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete exception",
        variant: "destructive",
      });
    }
  };

  const formatDateRange = (override: DateOverride) => {
    const start = format(parseISO(override.start_date), "MMM d, yyyy");
    if (override.end_date && override.end_date !== override.start_date) {
      const end = format(parseISO(override.end_date), "MMM d, yyyy");
      return `${start} - ${end}`;
    }
    return start;
  };

  // Filter to show only future or ongoing overrides
  const activeOverrides = overrides.filter(o => {
    const endDate = o.end_date ? parseISO(o.end_date) : parseISO(o.start_date);
    return !isBefore(endDate, new Date());
  });

  const pastOverrides = overrides.filter(o => {
    const endDate = o.end_date ? parseISO(o.end_date) : parseISO(o.start_date);
    return isBefore(endDate, new Date());
  });

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
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <CalendarX className="h-5 w-5" />
            Exceptions & Overrides
          </CardTitle>
          <CardDescription>
            Set closures or custom hours for specific dates
          </CardDescription>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1 shrink-0">
              <Plus className="h-4 w-4" />
              Add Exception
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Date Exception</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={newOverride.start_date}
                    onChange={(e) => setNewOverride(prev => ({ ...prev, start_date: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="end_date">End Date (optional)</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={newOverride.end_date}
                    onChange={(e) => setNewOverride(prev => ({ ...prev, end_date: e.target.value }))}
                    className="mt-1"
                    min={newOverride.start_date}
                  />
                </div>
              </div>

              {/* Exception Type Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Exception Type</Label>
                <RadioGroup
                  value={newOverride.is_closed ? "closed" : "custom"}
                  onValueChange={(val) => setNewOverride(prev => ({ 
                    ...prev, 
                    is_closed: val === "closed" 
                  }))}
                  className="space-y-3"
                >
                  <div 
                    className={`flex items-start space-x-3 p-4 rounded-lg border transition-colors cursor-pointer ${
                      newOverride.is_closed ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"
                    }`}
                    onClick={() => setNewOverride(prev => ({ ...prev, is_closed: true }))}
                  >
                    <RadioGroupItem value="closed" id="closed" className="mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-destructive" />
                        <Label htmlFor="closed" className="font-medium cursor-pointer">Closed</Label>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Venue completely unavailable for bookings on this date
                      </p>
                    </div>
                  </div>
                  <div 
                    className={`flex items-start space-x-3 p-4 rounded-lg border transition-colors cursor-pointer ${
                      !newOverride.is_closed ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"
                    }`}
                    onClick={() => setNewOverride(prev => ({ ...prev, is_closed: false }))}
                  >
                    <RadioGroupItem value="custom" id="custom" className="mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <Label htmlFor="custom" className="font-medium cursor-pointer">Custom Hours</Label>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Open with different hours than usual schedule
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {!newOverride.is_closed && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="custom_start">Custom Open Time</Label>
                    <Input
                      id="custom_start"
                      type="time"
                      value={newOverride.custom_start_time}
                      onChange={(e) => setNewOverride(prev => ({ ...prev, custom_start_time: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="custom_end">Custom Close Time</Label>
                    <Input
                      id="custom_end"
                      type="time"
                      value={newOverride.custom_end_time}
                      onChange={(e) => setNewOverride(prev => ({ ...prev, custom_end_time: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="note">Note (optional)</Label>
                <Textarea
                  id="note"
                  placeholder="e.g., Public Holiday, Maintenance, etc."
                  value={newOverride.note}
                  onChange={(e) => setNewOverride(prev => ({ ...prev, note: e.target.value }))}
                  className="mt-1"
                  rows={2}
                />
              </div>

              <Button onClick={handleAddOverride} disabled={saving} className="w-full">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Exception"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      
      <CardContent>
        {activeOverrides.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CalendarClock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No upcoming exceptions</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeOverrides.map(override => (
              <div
                key={override.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div className="font-medium">{formatDateRange(override)}</div>
                    {override.note && (
                      <p className="text-sm text-muted-foreground">{override.note}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {override.is_closed ? (
                    <Badge variant="destructive">Closed</Badge>
                  ) : (
                    <Badge variant="secondary">
                      {override.custom_start_time?.slice(0, 5)} - {override.custom_end_time?.slice(0, 5)}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteOverride(override.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {pastOverrides.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">
              Past exceptions ({pastOverrides.length})
            </p>
            <div className="space-y-1 opacity-50">
              {pastOverrides.slice(0, 3).map(override => (
                <div
                  key={override.id}
                  className="flex items-center justify-between p-2 rounded text-sm"
                >
                  <span>{formatDateRange(override)}</span>
                  <Badge variant="outline" className="text-xs">
                    {override.is_closed ? "Closed" : "Custom Hours"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
