import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SportIcon, getSportLabel } from "@/components/ui/sport-icon";
import { Loader2, Users, Calendar, MapPin, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { useTranslation } from "react-i18next";

type Group = Database["public"]["Tables"]["groups"]["Row"];

export default function JoinGroup() {
  const { code } = useParams<{ code: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation("discover");
  
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      localStorage.setItem('redirectAfterAuth', `/join/${code}`);
      navigate('/auth');
      return;
    }
    
    if (code && user) {
      validateInvite();
    }
  }, [code, user, authLoading]);

  const validateInvite = async () => {
    if (!code || !user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data: invitation, error: inviteError } = await supabase
        .from("group_invitations")
        .select("*, groups(*)")
        .eq("invite_code", code)
        .eq("is_active", true)
        .single();

      if (inviteError || !invitation) {
        setError(t("inviteInvalidOrExpired"));
        return;
      }

      if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
        setError(t("inviteExpired"));
        return;
      }

      if (invitation.max_uses && invitation.use_count >= invitation.max_uses) {
        setError(t("inviteMaxUses"));
        return;
      }

      const groupData = invitation.groups as unknown as Group;
      setGroup(groupData);

      const { data: existingMember } = await supabase
        .from("group_members")
        .select("id")
        .eq("group_id", groupData.id)
        .eq("user_id", user.id)
        .single();

      if (existingMember) {
        setAlreadyMember(true);
      }
    } catch (err) {
      console.error("Error validating invite:", err);
      setError(t("inviteInvalidOrExpired"));
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!group || !user || !code) return;
    
    setJoining(true);
    try {
      const { error: joinError } = await supabase
        .from("group_members")
        .insert({
          group_id: group.id,
          user_id: user.id,
          is_admin: false,
        });

      if (joinError) throw joinError;

      const { data: invitation } = await supabase
        .from("group_invitations")
        .select("use_count")
        .eq("invite_code", code)
        .single();

      if (invitation) {
        await supabase
          .from("group_invitations")
          .update({ use_count: (invitation.use_count || 0) + 1 })
          .eq("invite_code", code);
      }

      setJoined(true);
      toast.success(t("successfullyJoined") + " " + group.name + "!");
    } catch (err) {
      console.error("Error joining group:", err);
      toast.error("Failed to join the group. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  const getDayName = (dayOfWeek: number) => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[dayOfWeek] || "";
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  if (authLoading || loading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="px-4 py-6 max-w-md mx-auto pb-24">
        {error ? (
          <Card className="border-destructive/50">
            <CardContent className="p-6 text-center">
              <XCircle className="h-16 w-16 mx-auto mb-4 text-destructive" />
              <h2 className="text-xl font-semibold mb-2">{t("invitationInvalid")}</h2>
              <p className="text-muted-foreground mb-6">{error}</p>
              <Button onClick={() => navigate("/groups")} className="w-full">
                {t("viewGroup")}
              </Button>
            </CardContent>
          </Card>
        ) : joined ? (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="p-6 text-center">
              <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-primary" />
              <h2 className="text-xl font-semibold mb-2">{t("welcomeToTeam")}</h2>
              <p className="text-muted-foreground mb-6">
                {t("successfullyJoined")} <strong>{group?.name}</strong>
              </p>
              <Button onClick={() => navigate(`/groups/${group?.id}`)} className="w-full">
                {t("viewGroup")}
              </Button>
            </CardContent>
          </Card>
        ) : alreadyMember ? (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="p-6 text-center">
              <Users className="h-16 w-16 mx-auto mb-4 text-primary" />
              <h2 className="text-xl font-semibold mb-2">{t("alreadyMember")}</h2>
              <p className="text-muted-foreground mb-6">
                {t("alreadyMemberDesc")} <strong>{group?.name}</strong>
              </p>
              <Button onClick={() => navigate(`/groups/${group?.id}`)} className="w-full">
                {t("viewGroup")}
              </Button>
            </CardContent>
          </Card>
        ) : group ? (
          <Card>
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <SportIcon sport={group.sport_type} className="h-8 w-8" />
              </div>
              <CardTitle className="text-xl">{group.name}</CardTitle>
              <CardDescription>{t("invitedToJoin")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {group.description && (
                <p className="text-sm text-muted-foreground text-center">{group.description}</p>
              )}
              
              <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <SportIcon sport={group.sport_type} className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm">{getSportLabel(group.sport_type)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm">{group.city}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm">
                    {getDayName(group.default_day_of_week)}s at {formatTime(group.default_start_time)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm">
                    {group.min_players} - {group.max_players} players
                  </span>
                </div>
              </div>

              <Button onClick={handleJoin} disabled={joining} className="w-full" size="lg">
                {joining ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t("joining")}</>
                ) : (
                  <><Users className="h-4 w-4 mr-2" />{t("joinInviteLink")}</>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </MobileLayout>
  );
}
