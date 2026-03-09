import { useEffect, useMemo } from "react";
import { startOfWeek, endOfWeek } from "date-fns";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { GameCard } from "@/components/cards/GameCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, Search } from "lucide-react";
import { isBefore, parseISO } from "date-fns";
import { useMyGames, type GameData } from "@/hooks/useMyGames";
import { useTranslation } from "react-i18next";

const isSessionPast = (sessionDate: string, startTime: string): boolean => {
  return isBefore(parseISO(`${sessionDate}T${startTime}`), new Date());
};

export default function Games() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { data: allGames = [], isLoading: loading } = useMyGames(user?.id);
  const { t } = useTranslation("games");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const { upcomingGames, pastGames } = useMemo(() => {
    const upcoming: GameData[] = [];
    const past: GameData[] = [];

    allGames.forEach((game) => {
      const sessionDateStr = game.date.toISOString().split("T")[0];
      if (isSessionPast(sessionDateStr, game.time)) {
        past.push(game);
      } else {
        upcoming.push(game);
      }
    });

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    upcoming.sort((a, b) => {
      const aFeaturedThisWeek = a.state === "rescue" && a.date >= weekStart && a.date <= weekEnd;
      const bFeaturedThisWeek = b.state === "rescue" && b.date >= weekStart && b.date <= weekEnd;
      if (aFeaturedThisWeek && !bFeaturedThisWeek) return -1;
      if (!aFeaturedThisWeek && bFeaturedThisWeek) return 1;
      const dateDiff = a.date.getTime() - b.date.getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.time.localeCompare(b.time);
    });
    past.sort((a, b) => b.date.getTime() - a.date.getTime());

    return { upcomingGames: upcoming, pastGames: past };
  }, [allGames]);

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
      <div className="px-4 py-4 space-y-4 max-w-6xl mx-auto lg:px-6 lg:py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold">{t("title")}</h1>
            <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
          </div>
        </div>

        <Tabs defaultValue="upcoming">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="upcoming">{t("upcoming")}</TabsTrigger>
            <TabsTrigger value="past">{t("past")}</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : upcomingGames.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {upcomingGames.map((game) => (
                  <GameCard key={game.id} {...game} />
                ))}
              </div>
            ) : (
              <Card className="max-w-md mx-auto">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Calendar className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="font-display font-semibold text-lg mb-2">{t("noUpcoming")}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{t("noUpcomingDesc")}</p>
                  <Link to="/courts">
                    <Button className="btn-athletic gap-2">
                      <Search className="h-4 w-4" />
                      {t("browseCourts")}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="past" className="mt-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : pastGames.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pastGames.map((game) => (
                  <GameCard key={game.id} {...game} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>{t("noPast")}</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MobileLayout>
  );
}
