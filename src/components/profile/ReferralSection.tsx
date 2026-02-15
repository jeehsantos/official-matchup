import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Copy, Share2, Users, Check, Gift, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export function ReferralSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  // Fetch referral code from profile
  const { data: profile } = useQuery({
    queryKey: ["profile-referral", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("referral_code")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 30,
  });

  // Fetch referral stats
  const { data: referrals = [], isLoading: loadingReferrals } = useQuery({
    queryKey: ["user-referrals", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("referrals")
        .select("id, status, credited_amount, created_at")
        .eq("referrer_id", user.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch referral settings for display
  const { data: settings } = useQuery({
    queryKey: ["referral-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("referral_settings")
        .select("credit_amount, is_active")
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 1000 * 60 * 10,
  });

  const referralCode = profile?.referral_code || "";
  const referralUrl = `${window.location.origin}/auth?tab=signup&ref=${referralCode}`;
  const completedReferrals = referrals.filter(r => r.status === "completed");
  const pendingReferrals = referrals.filter(r => r.status === "pending");
  const totalEarned = completedReferrals.reduce((sum, r) => sum + (r.credited_amount || 0), 0);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      toast({ title: "Link copied!", description: "Share it with your friends." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Error", description: "Could not copy link.", variant: "destructive" });
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join Sport Arena!",
          text: `Join me on Sport Arena! Sign up using my referral link and we both get rewarded.`,
          url: referralUrl,
        });
      } catch {
        // User cancelled share
      }
    } else {
      handleCopy();
    }
  };

  if (!settings?.is_active) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Gift className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-semibold text-sm">Invite Friends</h3>
            <p className="text-xs text-muted-foreground">
              Earn ${settings?.credit_amount?.toFixed(2) || "5.00"} credit for each friend who joins & pays
            </p>
          </div>
        </div>

        {/* Referral link */}
        <div className="flex gap-2">
          <Input
            value={referralUrl}
            readOnly
            className="text-xs bg-muted/50 font-mono"
          />
          <Button size="icon" variant="outline" onClick={handleCopy} className="shrink-0">
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="default" onClick={handleShare} className="shrink-0">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Stats */}
        {loadingReferrals ? (
          <div className="flex justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : referrals.length > 0 ? (
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
            <div className="text-center">
              <p className="font-display font-bold text-lg text-primary">{completedReferrals.length}</p>
              <p className="text-[10px] text-muted-foreground">Completed</p>
            </div>
            <div className="text-center">
              <p className="font-display font-bold text-lg text-muted-foreground">{pendingReferrals.length}</p>
              <p className="text-[10px] text-muted-foreground">Pending</p>
            </div>
            <div className="text-center">
              <p className="font-display font-bold text-lg text-primary">${totalEarned.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">Earned</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-center text-muted-foreground pt-2 border-t border-border">
            Share your link to start earning credits!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
