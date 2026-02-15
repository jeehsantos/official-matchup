import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Gift, Loader2, Save } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

function AdminReferralSettingsContent() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [creditAmount, setCreditAmount] = useState("5.00");
  const [isActive, setIsActive] = useState(true);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-referral-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: referralStats } = useQuery({
    queryKey: ["admin-referral-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals")
        .select("status, credited_amount");
      if (error) throw error;
      const completed = (data || []).filter(r => r.status === "completed");
      const pending = (data || []).filter(r => r.status === "pending");
      const totalCredited = completed.reduce((sum, r) => sum + (r.credited_amount || 0), 0);
      return { total: data?.length || 0, completed: completed.length, pending: pending.length, totalCredited };
    },
  });

  useEffect(() => {
    if (settings) {
      setCreditAmount(settings.credit_amount?.toString() || "5.00");
      setIsActive(settings.is_active ?? true);
    }
  }, [settings]);

  const handleSave = async () => {
    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount < 0) {
      toast({ title: "Invalid amount", description: "Please enter a valid credit amount.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (settings?.id) {
        const { error } = await supabase
          .from("referral_settings")
          .update({ credit_amount: amount, is_active: isActive, updated_at: new Date().toISOString() })
          .eq("id", settings.id);
        if (error) throw error;
      }
      
      queryClient.invalidateQueries({ queryKey: ["admin-referral-settings"] });
      queryClient.invalidateQueries({ queryKey: ["referral-settings"] });
      toast({ title: "Settings saved", description: "Referral settings updated successfully." });
    } catch (error) {
      console.error("Error saving referral settings:", error);
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <MobileLayout showHeader={false} showBottomNav={false}>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout showHeader={false} showBottomNav={false}>
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="flex items-center gap-4 p-4 max-w-4xl mx-auto">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              <h1 className="font-display font-semibold text-xl">Referral Settings</h1>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-6 max-w-4xl mx-auto">
          {/* Stats */}
          {referralStats && (
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="font-display font-bold text-2xl text-primary">{referralStats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Referrals</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="font-display font-bold text-2xl text-primary">{referralStats.completed}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="font-display font-bold text-2xl text-primary">${referralStats.totalCredited.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Credits Awarded</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Set the credit amount awarded per successful referral</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Program Active</Label>
                  <p className="text-xs text-muted-foreground">Enable or disable the referral program</p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="creditAmount">Credit Amount per Referral ($)</Label>
                <Input
                  id="creditAmount"
                  type="number"
                  step="0.50"
                  min="0"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground">
                  This amount will be credited to the referrer when the referred user makes their first payment.
                </p>
              </div>

              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</>
                ) : (
                  <><Save className="h-4 w-4 mr-2" /> Save Settings</>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </MobileLayout>
  );
}

export default function AdminReferralSettings() {
  return (
    <ProtectedRoute requiredRole="admin">
      <AdminReferralSettingsContent />
    </ProtectedRoute>
  );
}
