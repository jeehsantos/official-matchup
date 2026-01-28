import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { GameCard } from "@/components/cards/GameCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, AlertTriangle, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSportCategories } from "@/hooks/useSportCategories";
import { useSurfaceTypes } from "@/hooks/useSurfaceTypes";
import { QuickGameModal } from "@/components/quick-challenge/QuickGameModal";
import { QuickChallengeCard } from "@/components/quick-challenge/QuickChallengeCard";
import { useQuickChallenges, useJoinChallenge } from "@/hooks/useQuickChallenges";

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

export default function Discover() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>(
    searchParams.get("filter") === "quickgames" ? "quickgames" : "rescue"
  );
  const [selectedSport, setSelectedSport] = useState("all");
  const [selectedCourtType, setSelectedCourtType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [rescueGames, setRescueGames] = useState<RescueGame[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [quickGameModalOpen, setQuickGameModalOpen] = useState(false);

  // Quick Challenges hooks
  const { data: quickChallenges = [], isLoading: loadingChallenges } = useQuickChallenges({
    sportCategoryId: selectedSport !== "all" ? selectedSport : undefined,
    status: "open",
  });
  const joinChallenge = useJoinChallenge();
  
  // Fetch dynamic categories from database - NO FALLBACKS
  const { data: sportCategories = [], isLoading: loadingSports } = useSportCategories();
  const { data: surfaceTypes = [], isLoading: loadingSurfaces } = useSurfaceTypes();
  
  // Build sports dropdown from database ONLY
  const sports = useMemo(() => {
    if (sportCategories.length === 0) return [{ value: "all", label: "All Sports", emoji: "🎯" }];
    return [
      { value: "all", label: "All Sports", emoji: "🎯" },
      ...sportCategories.map(cat => ({
        value: cat.name,
        label: cat.display_name,
        emoji: cat.icon || "🎯",
      }))
    ];
  }, [sportCategories]);
  
  // Build court types dropdown from database ONLY
  const courtTypes = useMemo(() => {
    if (surfaceTypes.length === 0) return [{ value: "all", label: "All Surfaces", emoji: "🎯" }];
    return [
      { value: "all", label: "All Surfaces", emoji: "🎯" },
      ...surfaceTypes.map(surface => ({
        value: surface.name,
        label: surface.display_name,
        emoji: surface.name === "grass" ? "🌱" : 
               surface.name === "turf" ? "🟩" :
               surface.name === "sand" ? "🏖️" :
               surface.name === "hard" ? "🟫" :
               surface.name === "clay" ? "🟠" : "🎯",
      }))
    ];
  }, [surfaceTypes]);

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
          payment_type,
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

      // Get player counts for each session and filter out sessions user already joined
      const rescueGamesData: RescueGame[] = [];
      
      for (const session of (rescueSessions || [])) {
        // Check if current user is already in this session
        const { data: existingPlayer } = await supabase
          .from("session_players")
          .select("id")
          .eq("session_id", session.id)
          .eq("user_id", user!.id)
          .maybeSingle();

        // Skip sessions user already joined
        if (existingPlayer) continue;

        const { count } = await supabase
          .from("session_players")
          .select("*", { count: "exact", head: true })
          .eq("session_id", session.id);

        const group = session.groups as any;
        const court = session.courts as any;
        
        // If organizer pays (payment_type = 'single'), price is 0 (free for players)
        const isFreeForPlayers = session.payment_type === "single";
        
        rescueGamesData.push({
          id: session.id,
          groupName: group?.name || "Unknown Group",
          sport: (group?.sport_type || "other") as SportType,
          courtName: court?.name || "Court",
          venueName: court?.venues?.name || "Venue",
          date: new Date(session.session_date),
          time: session.start_time.slice(0, 5),
          price: isFreeForPlayers ? 0 : session.court_price / session.min_players,
          currentPlayers: count || 0,
          minPlayers: session.min_players,
          maxPlayers: session.max_players,
          state: "rescue" as const,
        });
      }

      setRescueGames(rescueGamesData);

      // Quick challenges are fetched separately via useQuickChallenges hook
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

  // Filter quick challenges based on search
  const filteredChallenges = useMemo(() => {
    if (!searchQuery) return quickChallenges;
    return quickChallenges.filter((challenge) => {
      const sportName = challenge.sport_categories?.display_name?.toLowerCase() || "";
      const venueName = challenge.venues?.name?.toLowerCase() || "";
      return sportName.includes(searchQuery.toLowerCase()) ||
             venueName.includes(searchQuery.toLowerCase());
    });
  }, [quickChallenges, searchQuery]);

  // Handle joining a challenge slot
  const handleJoinSlot = (challengeId: string, team: "left" | "right", slotPosition: number) => {
    joinChallenge.mutate({ challengeId, team, slotPosition });
  };

  // Handle payment for a challenge
  const handlePayment = (challengeId: string) => {
    // TODO: Integrate with Stripe checkout
    console.log("Payment for challenge:", challengeId);
  };

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
        {/* Header with Quick Game Button */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold">Find Games</h1>
            <p className="text-muted-foreground text-sm">
              Join rescue games or quick challenges
            </p>
          </div>
          <Button
            onClick={() => setQuickGameModalOpen(true)}
            className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Quick Game</span>
            <span className="sm:hidden">Quick</span>
          </Button>
        </div>

        {/* Info Banner */}
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="p-4 flex items-start gap-3">
            <Zap className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Quick Challenges</p>
              <p className="text-sm text-muted-foreground">
                Find players for instant matches or join rescue games that need extra players!
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

        {/* Filter Dropdowns */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Sport Filter */}
          {loadingSports ? (
            <div className="flex items-center gap-2 h-11 px-3 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading sports...</span>
            </div>
          ) : (
            <Select value={selectedSport} onValueChange={setSelectedSport}>
              <SelectTrigger className="w-full sm:w-[180px] h-11">
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <span>{sports.find(s => s.value === selectedSport)?.emoji}</span>
                    <span>{sports.find(s => s.value === selectedSport)?.label}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                {sports.map((sport) => (
                  <SelectItem key={sport.value} value={sport.value}>
                    <div className="flex items-center gap-2">
                      <span>{sport.emoji}</span>
                      <span>{sport.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Court Type Filter */}
          {loadingSurfaces ? (
            <div className="flex items-center gap-2 h-11 px-3 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading surfaces...</span>
            </div>
          ) : (
            <Select value={selectedCourtType} onValueChange={setSelectedCourtType}>
              <SelectTrigger className="w-full sm:w-[180px] h-11">
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <span>{courtTypes.find(c => c.value === selectedCourtType)?.emoji}</span>
                    <span>{courtTypes.find(c => c.value === selectedCourtType)?.label}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                {courtTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <span>{type.emoji}</span>
                      <span>{type.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
            <TabsTrigger value="quickgames" className="gap-2">
              <Zap className="h-4 w-4" />
              Quick Games
              {filteredChallenges.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-primary text-primary-foreground rounded-full text-xs font-bold">
                  {filteredChallenges.length}
                </span>
              )}
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

          <TabsContent value="quickgames" className="mt-4">
            {loadingChallenges ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredChallenges.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {filteredChallenges.map((challenge) => (
                  <QuickChallengeCard
                    key={challenge.id}
                    challenge={{
                      id: challenge.id,
                      sportCategoryId: challenge.sport_category_id,
                      sportName: challenge.sport_categories?.display_name,
                      sportIcon: challenge.sport_categories?.icon || "🎯",
                      gameMode: challenge.game_mode,
                      status: challenge.status,
                      venueName: challenge.venues?.name,
                      venueAddress: challenge.venues?.address,
                      scheduledDate: challenge.scheduled_date || undefined,
                      scheduledTime: challenge.scheduled_time || undefined,
                      pricePerPlayer: challenge.price_per_player,
                      totalSlots: challenge.total_slots,
                      players: (challenge.quick_challenge_players || []).map(p => ({
                        id: p.id,
                        userId: p.user_id,
                        name: p.profiles?.full_name || "Player",
                        avatarUrl: p.profiles?.avatar_url,
                        nationalityCode: null,
                        paymentStatus: p.payment_status as "pending" | "paid" | "refunded",
                        team: p.team as "left" | "right",
                        slotPosition: p.slot_position,
                      })),
                    }}
                    currentUserId={user?.id}
                    onJoinSlot={handleJoinSlot}
                    onPayment={handlePayment}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-8 w-8 opacity-50" />
                </div>
                <p className="font-medium">No quick games yet</p>
                <p className="text-sm mt-1">
                  Be the first to create a quick challenge!
                </p>
                <Button 
                  className="mt-4 gap-2"
                  onClick={() => setQuickGameModalOpen(true)}
                >
                  <Zap className="h-4 w-4" />
                  Create Quick Game
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Quick Game Modal */}
        <QuickGameModal 
          open={quickGameModalOpen} 
          onOpenChange={setQuickGameModalOpen} 
        />
      </div>
    </MobileLayout>
  );
}
