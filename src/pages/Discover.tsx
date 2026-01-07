import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { GameCard } from "@/components/cards/GameCard";
import { GroupCard } from "@/components/cards/GroupCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, MapPin, Filter } from "lucide-react";
import { addDays } from "date-fns";

// Demo data
const rescueGames = [
  {
    id: "3",
    groupName: "Hoops After Work",
    sport: "basketball" as const,
    courtName: "Outdoor Court",
    venueName: "Albany Basketball",
    date: addDays(new Date(), 1),
    time: "6:30 PM",
    price: 10.0,
    currentPlayers: 5,
    minPlayers: 8,
    maxPlayers: 10,
    state: "rescue" as const,
  },
  {
    id: "4",
    groupName: "Friday Night Futsal",
    sport: "futsal" as const,
    courtName: "Indoor Arena",
    venueName: "City Futsal",
    date: addDays(new Date(), 3),
    time: "8:00 PM",
    price: 15.0,
    currentPlayers: 7,
    minPlayers: 10,
    maxPlayers: 12,
    state: "rescue" as const,
  },
];

const publicGroups = [
  {
    id: "5",
    name: "Tennis Tuesdays",
    sport: "tennis" as const,
    city: "Takapuna",
    memberCount: 24,
    schedule: "Tuesdays at 6:00 PM",
    isPublic: true,
  },
  {
    id: "6",
    name: "Volleyball Vibes",
    sport: "volleyball" as const,
    city: "Auckland CBD",
    memberCount: 32,
    schedule: "Saturdays at 10:00 AM",
    isPublic: true,
  },
];

const sports = [
  { value: "all", label: "All Sports" },
  { value: "futsal", label: "⚽ Futsal" },
  { value: "basketball", label: "🏀 Basketball" },
  { value: "tennis", label: "🎾 Tennis" },
  { value: "volleyball", label: "🏐 Volleyball" },
  { value: "badminton", label: "🏸 Badminton" },
];

export default function Discover() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>(
    searchParams.get("filter") === "rescue" ? "rescue" : "groups"
  );
  const [selectedSport, setSelectedSport] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, isLoading, navigate]);

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
      <div className="px-4 py-4 space-y-4">
        {/* Header */}
        <div>
          <h1 className="font-display text-2xl font-bold">Discover</h1>
          <p className="text-muted-foreground text-sm">
            Find games and groups near you
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by sport, venue, or location..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Sport filters */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {sports.map((sport) => (
            <Badge
              key={sport.value}
              variant={selectedSport === sport.value ? "default" : "outline"}
              className="cursor-pointer whitespace-nowrap"
              onClick={() => setSelectedSport(sport.value)}
            >
              {sport.label}
            </Badge>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="rescue" className="relative">
              Rescue Games
              {rescueGames.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-warning text-warning-foreground rounded-full text-xs flex items-center justify-center font-bold">
                  {rescueGames.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="groups">Public Groups</TabsTrigger>
          </TabsList>

          <TabsContent value="rescue" className="space-y-3 mt-4">
            {rescueGames.length > 0 ? (
              rescueGames.map((game) => (
                <GameCard key={game.id} {...game} />
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No rescue games available right now</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="groups" className="mt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {publicGroups.map((group) => (
                <GroupCard key={group.id} {...group} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MobileLayout>
  );
}