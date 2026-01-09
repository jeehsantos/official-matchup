import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Clock } from "lucide-react";
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
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

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
          <Clock className="h-5 w-5" />
          Weekly Schedule
        </CardTitle>
        <CardDescription>
          Set your regular opening hours for each day of the week
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {DAYS_OF_WEEK.map(day => {
          const rule = rules[day.value];
          return (
            <div 
              key={day.value} 
              className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border bg-card"
            >
              <div className="w-24 font-medium">{day.label}</div>
              
              <div className="flex items-center gap-2">
                <Switch
                  checked={!rule.is_closed}
                  onCheckedChange={(checked) => handleRuleChange(day.value, "is_closed", !checked)}
                />
                <Label className="text-sm text-muted-foreground">
                  {rule.is_closed ? "Closed" : "Open"}
                </Label>
              </div>

              {!rule.is_closed && (
                <>
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      type="time"
                      value={rule.start_time}
                      onChange={(e) => handleRuleChange(day.value, "start_time", e.target.value)}
                      className="w-32"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={rule.end_time}
                      onChange={(e) => handleRuleChange(day.value, "end_time", e.target.value)}
                      className="w-32"
                    />
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyToAll(day.value)}
                    className="text-xs"
                  >
                    Copy to all
                  </Button>
                </>
              )}
            </div>
          );
        })}

        <Button onClick={handleSave} disabled={saving} className="w-full">
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
