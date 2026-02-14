import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, DollarSign, Loader2, Save, Info } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

function AdminPlatformFeesContent() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [playerFee, setPlayerFee] = useState("1.50");
  const [managerFeePercentage, setManagerFeePercentage] = useState("0");
  const [isActive, setIsActive] = useState(true);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-platform-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings) {
      setPlayerFee(settings.player_fee?.toString() || "1.50");
      setManagerFeePercentage(settings.manager_fee_percentage?.toString() || "0");
      setIsActive(settings.is_active ?? true);
    }
  }, [settings]);

  const handleSave = async () => {
    const fee = parseFloat(playerFee);
    const managerPct = parseFloat(managerFeePercentage);
    
    if (isNaN(fee) || fee < 0) {
      toast({ title: "Invalid amount", description: "Please enter a valid player fee amount.", variant: "destructive" });
      return;
    }
    if (isNaN(managerPct) || managerPct < 0 || managerPct > 100) {
      toast({ title: "Invalid percentage", description: "Manager fee must be between 0 and 100%.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (settings?.id) {
        const { error } = await supabase
          .from("platform_settings")
          .update({
            player_fee: fee,
            manager_fee_percentage: managerPct,
            is_active: isActive,
            updated_at: new Date().toISOString(),
          })
          .eq("id", settings.id);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["admin-platform-settings"] });
      queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
      toast({ title: "Settings saved", description: "Platform fee settings updated successfully." });
    } catch (error) {
      console.error("Error saving platform settings:", error);
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Platform Fees">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  // Example calculation
  const exampleCourtPrice = 50;
  const examplePlayerFee = parseFloat(playerFee) || 0;
  const exampleManagerPct = parseFloat(managerFeePercentage) || 0;
  const examplePlayerTotal = exampleCourtPrice + examplePlayerFee;
  const exampleManagerDeduction = (exampleCourtPrice * exampleManagerPct) / 100;
  const exampleManagerPayout = exampleCourtPrice - exampleManagerDeduction;
  const examplePlatformRevenue = examplePlayerFee + exampleManagerDeduction;

  return (
    <AdminLayout title="Platform Fees">
      <div className="space-y-6">
        {/* Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Commission Configuration
            </CardTitle>
            <CardDescription>
              Set the platform commission fees charged to players and court managers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Fees Active</Label>
                <p className="text-xs text-muted-foreground">Enable or disable platform commission fees</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="playerFee">Player Service Fee ($)</Label>
                <Input
                  id="playerFee"
                  type="number"
                  step="0.10"
                  min="0"
                  value={playerFee}
                  onChange={(e) => setPlayerFee(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Fixed amount added to the player's total at checkout. This fee goes directly to the platform.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="managerFee">Manager Commission (%)</Label>
                <Input
                  id="managerFee"
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={managerFeePercentage}
                  onChange={(e) => setManagerFeePercentage(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Percentage deducted from the court manager's payout. This portion goes to the platform.
                </p>
              </div>
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

        {/* Example Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4 text-muted-foreground" />
              Fee Breakdown Example
            </CardTitle>
            <CardDescription>
              Based on a ${exampleCourtPrice.toFixed(2)} court booking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Court price</span>
                <span className="font-medium">${exampleCourtPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Player service fee</span>
                <span className="font-medium text-primary">+ ${examplePlayerFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border font-semibold">
                <span>Player pays (total)</span>
                <span>${examplePlayerTotal.toFixed(2)}</span>
              </div>
              
              <div className="pt-2" />
              
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Manager commission ({exampleManagerPct}%)</span>
                <span className="font-medium text-destructive">- ${exampleManagerDeduction.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Manager receives</span>
                <span className="font-medium">${exampleManagerPayout.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 font-semibold text-primary">
                <span>Platform revenue</span>
                <span>${examplePlatformRevenue.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

export default function AdminPlatformFees() {
  return (
    <ProtectedRoute requiredRole="admin">
      <AdminPlatformFeesContent />
    </ProtectedRoute>
  );
}
