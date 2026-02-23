import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, Clock, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WeeklyRule {
  id?: string;
  venue_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_closed: boolean;
}

interface WeeklyScheduleEditorProps {
  venueId: string;
  onScheduleUpdated?: () => void;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

// Generate time options in 30-minute intervals
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2);
  const minutes = i % 2 === 0 ? "00" : "30";
  const time = `${hours.toString().padStart(2, "0")}:${minutes}`;
  const displayHours = hours % 12 || 12;
  const amPm = hours < 12 ? "AM" : "PM";
  return {
    value: time,
    label: `${displayHours}:${minutes} ${amPm}`,
  };
});

export function WeeklyScheduleEditor({ venueId, onScheduleUpdated }: WeeklyScheduleEditorProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<Record<number, WeeklyRule>>({});

  useEffect(() => {
    fetchRules();
  }, [venueId]);

  const fetchRules = async () => {
    try {
      const { data, error } = await supabase
        .from("venue_weekly_rules")
        .select("*")
        .eq("venue_id", venueId);

      if (error) throw error;

      // Convert to a map by day_of_week
      const rulesMap: Record<number, WeeklyRule> = {};
      
      // Initialize all days with defaults
      DAYS_OF_WEEK.forEach(day => {
        const existingRule = data?.find(r => r.day_of_week === day.value);
        rulesMap[day.value] = existingRule || {
          venue_id: venueId,
          day_of_week: day.value,
          start_time: "09:00",
          end_time: "21:00",
          is_closed: true,
        };
      });

      setRules(rulesMap);
    } catch (error) {
      console.error("Error fetching weekly rules:", error);
      toast({
        title: "Error",
        description: "Failed to load weekly schedule",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRuleChange = (dayOfWeek: number, field: keyof WeeklyRule, value: any) => {
    setRules(prev => ({
      ...prev,
      [dayOfWeek]: {
        ...prev[dayOfWeek],
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Upsert all rules
      for (const day of DAYS_OF_WEEK) {
        const rule = rules[day.value];
        
        if (rule.id) {
          // Update existing
          const { error } = await supabase
            .from("venue_weekly_rules")
            .update({
              start_time: rule.start_time,
              end_time: rule.end_time,
              is_closed: rule.is_closed,
            })
            .eq("id", rule.id);
          
          if (error) throw error;
        } else if (!rule.is_closed) {
          // Only insert if not closed (no need to store closed days without times)
          const { error } = await supabase
            .from("venue_weekly_rules")
            .insert({
              venue_id: venueId,
              day_of_week: day.value,
              start_time: rule.start_time,
              end_time: rule.end_time,
              is_closed: rule.is_closed,
            });
          
          if (error) throw error;
        }
      }

      toast({ title: "Weekly schedule saved" });
      onScheduleUpdated?.();
      fetchRules(); // Refresh to get IDs
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save schedule",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyToAll = (sourceDayOfWeek: number) => {
    const sourceRule = rules[sourceDayOfWeek];
    setRules(prev => {
      const newRules = { ...prev };
      DAYS_OF_WEEK.forEach(day => {
        if (day.value !== sourceDayOfWeek) {
          newRules[day.value] = {
            ...newRules[day.value],
            start_time: sourceRule.start_time,
            end_time: sourceRule.end_time,
            is_closed: sourceRule.is_closed,
          };
        }
      });
      return newRules;
    });
  };

  const formatTimeDisplay = (time: string) => {
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours, 10);
    const displayHours = h % 12 || 12;
    const amPm = h < 12 ? "AM" : "PM";
    return `${displayHours}:${minutes} ${amPm}`;
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
          <Clock className="h-5 w-5" />
          Weekly Schedule
        </CardTitle>
        <CardDescription>
          Set your regular opening hours for each day of the week
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {DAYS_OF_WEEK.map(day => {
          const rule = rules[day.value];
          const isOpen = !rule.is_closed;
          
          return (
            <div 
              key={day.value} 
              className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border transition-colors ${
                isOpen ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-muted"
              }`}
            >
              {/* Day name and toggle */}
              <div className="flex items-center justify-between sm:justify-start gap-3 min-w-[140px]">
                <span className="font-medium w-24">
                  <span className="hidden sm:inline">{day.label}</span>
                  <span className="sm:hidden">{day.short}</span>
                </span>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={isOpen}
                    onCheckedChange={(checked) => handleRuleChange(day.value, "is_closed", !checked)}
                  />
                  <Label className={`text-sm ${isOpen ? "text-primary font-medium" : "text-muted-foreground"}`}>
                    {isOpen ? "Open" : "Closed"}
                  </Label>
                </div>
              </div>

              {/* Time selectors */}
              {isOpen && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 w-full">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 w-full">
                    <Select
                      value={rule.start_time}
                      onValueChange={(value) => handleRuleChange(day.value, "start_time", value)}
                    >
                      <SelectTrigger className="w-full min-w-0 bg-background">
                        <SelectValue>{formatTimeDisplay(rule.start_time)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-[280px]">
                        {TIME_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <span className="text-muted-foreground text-sm">to</span>
                    
                    <Select
                      value={rule.end_time}
                      onValueChange={(value) => handleRuleChange(day.value, "end_time", value)}
                    >
                      <SelectTrigger className="w-full min-w-0 bg-background">
                        <SelectValue>{formatTimeDisplay(rule.end_time)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-[280px]">
                        {TIME_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyToAll(day.value)}
                    className="text-xs gap-1 ml-auto self-end sm:self-auto"
                  >
                    <Copy className="h-3 w-3" />
                    <span className="hidden sm:inline">Copy to all</span>
                    <span className="sm:hidden">Copy</span>
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        <Button onClick={handleSave} disabled={saving} className="w-full mt-4">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Schedule
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
