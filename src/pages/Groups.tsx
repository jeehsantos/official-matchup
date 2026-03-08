import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { GroupCard } from "@/components/cards/GroupCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Loader2, Users } from "lucide-react";
import { Link } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";
import { useTranslation } from "react-i18next";

type Group = Database["public"]["Tables"]["groups"]["Row"];

interface GroupWithMemberCount extends Group {
  memberCount: number;
}

const getDayName = (dayOfWeek: number): string => {
  const days = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
  return days[dayOfWeek] || "";
};

const formatTime = (time: string): string => {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

export default function Groups() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation("groups");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const { data: myGroups = [], isLoading: loading } = useQuery<GroupWithMemberCount[]>({
    queryKey: ["my-groups", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: organizerGroups, error: orgError } = await supabase
        .from("groups")
        .select("*")
        .eq("organizer_id", user.id)
        .eq("is_active", true);

      if (orgError) {
        console.error("Error fetching organizer groups:", orgError);
        return [];
      }

      const { data: memberships, error: memError } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id);

      if (memError) {
        console.error("Error fetching memberships:", memError);
      }

      const memberGroupIds = (memberships || []).map(m => m.group_id);
      
      let memberGroups: typeof organizerGroups = [];
      if (memberGroupIds.length > 0) {
        const { data: mGroups, error: mErr } = await supabase
          .from("groups")
          .select("*")
          .in("id", memberGroupIds)
          .eq("is_active", true);
        
        if (!mErr) {
          memberGroups = mGroups || [];
        }
      }

      const allGroupsMap = new Map<string, typeof organizerGroups[0]>();
      [...(organizerGroups || []), ...(memberGroups || [])].forEach(g => {
        allGroupsMap.set(g.id, g);
      });
      
      const allGroups = Array.from(allGroupsMap.values());

      const groupsWithCounts: GroupWithMemberCount[] = await Promise.all(
        allGroups.map(async (group) => {
          const { count } = await supabase
            .from("group_members")
            .select("*", { count: "exact", head: true })
            .eq("group_id", group.id);
          
          return {
            ...group,
            memberCount: (count || 0) + 1,
          };
        })
      );

      return groupsWithCounts;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 3,
    refetchOnWindowFocus: true,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <MobileLayout>
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">{t("title")}</h1>
          <Link to="/groups/create">
            <Button size="sm" className="btn-athletic">
              <Plus className="h-4 w-4 mr-1" />
              {t("new")}
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : myGroups.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {myGroups.map((group) => (
              <GroupCard
                key={group.id}
                id={group.id}
                name={group.name}
                sport={group.sport_type}
                city={group.city}
                memberCount={group.memberCount}
                schedule={`${getDayName(group.default_day_of_week)} at ${formatTime(group.default_start_time)}`}
                isPublic={group.is_public || false}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-lg mb-2">{t("noGroups")}</h3>
              <p className="text-muted-foreground text-sm mb-4">{t("noGroupsDesc")}</p>
              <Link to="/courts">
                <Button className="btn-athletic">{t("browseCourts")}</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </MobileLayout>
  );
}
