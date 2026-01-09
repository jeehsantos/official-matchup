import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { GameCard } from "@/components/cards/GameCard";
import { GroupCard } from "@/components/cards/GroupCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Search, AlertTriangle, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type SportType = "futsal" | "tennis" | "volleyball" | "basketball" | "turf_hockey" | "badminton" | "other";

interface RescueGame {
  id: string;
  groupName: string;
  sport: SportType;
  courtName: string;
  venueName: string;
  date: Date;
  time: string;
  price: number;
  currentPlayers: number;
  minPlayers: number;
  maxPlayers: number;
  state: "rescue";
}

interface PublicGroup {
  id: string;
  name: string;
  sport: SportType;
  city: string;
  memberCount: number;
  schedule: string;
  isPublic: boolean;
  weeklyPrice: number;
}

const sports = [
  { value: "all", label: "All Sports", emoji: "🎯" },
  { value: "futsal", label: "Futsal", emoji: "⚽" },
  { value: "basketball", label: "Basketball", emoji: "🏀" },
  { value: "tennis", label: "Tennis", emoji: "🎾" },
  { value: "volleyball", label: "Volleyball", emoji: "🏐" },
  { value: "badminton", label: "Badminton", emoji: "🏸" },
];

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Discover() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>(
    searchParams.get("filter") === "groups" ? "groups" : "rescue"
  );
  const [selectedSport, setSelectedSport] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [rescueGames, setRescueGames] = useState<RescueGame[]>([]);
  const [publicGroups, setPublicGroups] = useState<PublicGroup[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoadingData(true);
    try {
      // Fetch rescue sessions (sessions in rescue mode that are open)
      const today = new Date().toISOString().split('T')[0];
      const { data: rescueSessions } = await supabase
        .from("sessions")
        .select(`
          id,
          session_date,
          start_time,
          court_price,
          min_players,
          max_players,
          state,
          is_rescue_open,
          is_cancelled,
          groups (
            id,
            name,
            sport_type,
            city
          ),
          courts (
            name,
            venues (
              name
            )
          )
        `)
        .eq("state", "rescue")
        .eq("is_rescue_open", true)
        .eq("is_cancelled", false)
        .gte("session_date", today)
        .order("session_date", { ascending: true });

      // Get player counts for each session
      const rescueGamesData: RescueGame[] = await Promise.all(
        (rescueSessions || []).map(async (session) => {
          const { count } = await supabase
            .from("session_players")
            .select("*", { count: "exact", head: true })
            .eq("session_id", session.id);

          const group = session.groups as any;
          const court = session.courts as any;
          
          return {
            id: session.id,
            groupName: group?.name || "Unknown Group",
            sport: (group?.sport_type || "other") as SportType,
            courtName: court?.name || "Court",
            venueName: court?.venues?.name || "Venue",
            date: new Date(session.session_date),
            time: session.start_time.slice(0, 5),
            price: session.court_price / session.min_players,
            currentPlayers: count || 0,
            minPlayers: session.min_players,
            maxPlayers: session.max_players,
            state: "rescue" as const,
          };
        })
      );

      setRescueGames(rescueGamesData);

      // Fetch public groups
      const { data: groups } = await supabase
        .from("groups")
        .select("*")
        .eq("is_public", true)
        .eq("is_active", true);

      const publicGroupsData: PublicGroup[] = await Promise.all(
        (groups || []).map(async (group) => {
          const { count } = await supabase
            .from("group_members")
            .select("*", { count: "exact", head: true })
            .eq("group_id", group.id);

          const dayName = dayNames[group.default_day_of_week];
          const time = group.default_start_time.slice(0, 5);

          return {
            id: group.id,
            name: group.name,
            sport: group.sport_type as SportType,
            city: group.city,
            memberCount: count || 0,
            schedule: `${dayName}s at ${time}`,
            isPublic: true,
            weeklyPrice: group.weekly_court_price / group.min_players,
          };
        })
      );

      setPublicGroups(publicGroupsData);
    } catch (error) {
      console.error("Error fetching discover data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  // Filter rescue games based on sport and search
  const filteredRescueGames = useMemo(() => {
    return rescueGames.filter((game) => {
      const matchesSport = selectedSport === "all" || game.sport === selectedSport;
      const matchesSearch = searchQuery === "" || 
        game.groupName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        game.venueName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        game.sport.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSport && matchesSearch;
    });
  }, [rescueGames, selectedSport, searchQuery]);

  // Filter public groups based on sport and search
  const filteredGroups = useMemo(() => {
    return publicGroups.filter((group) => {
      const matchesSport = selectedSport === "all" || group.sport === selectedSport;
      const matchesSearch = searchQuery === "" || 
        group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.sport.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSport && matchesSearch;
    });
  }, [publicGroups, selectedSport, searchQuery]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <MobileLayout>
      <div className="px-4 py-4 space-y-4 max-w-6xl mx-auto lg:px-6">
        {/* Header */}
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Find Games</h1>
          <p className="text-muted-foreground text-sm">
            Join rescue games or discover public groups
          </p>
        </div>

        {/* Info Banner */}
        <Card className="bg-warning/10 border-warning/20">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Rescue Games Need You!</p>
              <p className="text-sm text-muted-foreground">
                These games are short on players. Join now and help save the game!
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search games, groups, or sports..."
            className="pl-10 h-11"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Sport filters */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 lg:mx-0 lg:px-0 lg:flex-wrap">
          {sports.map((sport) => (
            <Badge
              key={sport.value}
              variant={selectedSport === sport.value ? "default" : "outline"}
              className={`cursor-pointer whitespace-nowrap px-3 py-1.5 text-sm transition-all shrink-0 ${
                selectedSport === sport.value 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-muted"
              }`}
              onClick={() => setSelectedSport(sport.value)}
            >
              <span className="mr-1.5">{sport.emoji}</span>
              {sport.label}
            </Badge>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="rescue" className="relative gap-2">
              <AlertTriangle className="h-4 w-4" />
              Rescue Games
              {filteredRescueGames.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-warning text-warning-foreground rounded-full text-xs font-bold">
                  {filteredRescueGames.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="groups" className="gap-2">
              <Users className="h-4 w-4" />
              Public Groups
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rescue" className="mt-4">
            {loadingData ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredRescueGames.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredRescueGames.map((game) => (
                  <GameCard key={game.id} {...game} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="h-8 w-8 opacity-50" />
                </div>
                <p className="font-medium">No rescue games found</p>
                <p className="text-sm mt-1">
                  {selectedSport !== "all" 
                    ? `Try selecting a different sport or clear filters`
                    : "Check back later for games that need players"}
                </p>
                {selectedSport !== "all" && (
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setSelectedSport("all")}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="groups" className="mt-4">
            {loadingData ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredGroups.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredGroups.map((group) => (
                  <GroupCard key={group.id} {...group} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 opacity-50" />
                </div>
                <p className="font-medium">No groups found</p>
                <p className="text-sm mt-1">
                  {selectedSport !== "all" 
                    ? `Try selecting a different sport or clear filters`
                    : "Check back later for new groups"}
                </p>
                {selectedSport !== "all" && (
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setSelectedSport("all")}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MobileLayout>
  );
}