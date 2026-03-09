import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { GameCard } from "@/components/cards/GameCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Search, AlertTriangle, Zap, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSportCategories } from "@/hooks/useSportCategories";
import { useSurfaceTypes } from "@/hooks/useSurfaceTypes";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useIsMobile } from "@/hooks/use-mobile";
import { QuickGameModal } from "@/components/quick-challenge/QuickGameModal";
import { QuickChallengeSummaryCard } from "@/components/quick-challenge/QuickChallengeSummaryCard";
import { useQuickChallenges } from "@/hooks/useQuickChallenges";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type SportType = "futsal" | "tennis" | "volleyball" | "basketball" | "turf_hockey" | "badminton" | "other";

interface RescueGame {
  id: string;
  groupName: string;
  sport: SportType;
  courtName: string;
  venueName: string;
  city: string;
  groundType: string | null;
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
  const isMobile = useIsMobile();
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { preferredSports, profile } = useUserProfile();
  const [activeTab, setActiveTab] = useState<string>(
    searchParams.get("tab") === "quickgames" ? "quickgames" : "rescue"
  );
  const [selectedSport, setSelectedSport] = useState("all");
  const [hasAppliedPreferredSportDefault, setHasAppliedPreferredSportDefault] = useState(false);
  const [selectedCourtType, setSelectedCourtType] = useState("all");
  const [selectedCity, setSelectedCity] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [todayOnly, setTodayOnly] = useState(false);
  const [rescueGames, setRescueGames] = useState<RescueGame[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [quickGameModalOpen, setQuickGameModalOpen] = useState(false);
  const [selectedQuickChallengeId, setSelectedQuickChallengeId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState("");
  const [showAllCities, setShowAllCities] = useState(false);
  const [rescuePage, setRescuePage] = useState(1);
  const [challengePage, setChallengePage] = useState(1);
  const ITEMS_PER_PAGE = 18;

  // Fetch dynamic categories from database - NO FALLBACKS
  const { data: sportCategories = [] } = useSportCategories();
  const { data: surfaceTypes = [] } = useSurfaceTypes();

  const normalizedPreferredSports = useMemo(() => {
    if (preferredSports.length === 0) return [];

    const normalizedCategoryLookup = new Map<string, string>();
    sportCategories.forEach((category) => {
      normalizedCategoryLookup.set(category.name.toLowerCase(), category.name);
      normalizedCategoryLookup.set(category.display_name.toLowerCase(), category.name);
    });

    return Array.from(
      new Set(
        preferredSports.map((sport) => {
          const normalized = sport.trim().toLowerCase();
          return normalizedCategoryLookup.get(normalized) || normalized;
        })
      )
    );
  }, [preferredSports, sportCategories]);

  const selectedSportCategoryId = useMemo(() => {
    if (selectedSport === "all") return undefined;
    return sportCategories.find((cat) => cat.name === selectedSport)?.id;
  }, [selectedSport, sportCategories]);

  // Quick Challenges hooks
  const { data: quickChallenges = [], isLoading: loadingChallenges } = useQuickChallenges({
    sportCategoryId: selectedSportCategoryId,
    status: "open",
  });
  
  // Build sports dropdown from user's preferred sports only
  const sports = useMemo(() => {
    const preferredSportSet = new Set(normalizedPreferredSports);
    const preferredOptions = sportCategories
      .filter((cat) => preferredSportSet.has(cat.name))
      .map((cat) => ({
        value: cat.name,
        label: cat.display_name,
        emoji: cat.icon || "🎯",
      }));

    // If only one preferred sport, just show that one
    if (preferredOptions.length === 1) return preferredOptions;

    // Multiple preferred sports: show "All Sports" (meaning all preferred) + individual
    if (preferredOptions.length > 1) {
      return [
        { value: "all", label: "All Sports", emoji: "🎯" },
        ...preferredOptions,
      ];
    }

    // Fallback: no preferred sports
    return [{ value: "all", label: "All Sports", emoji: "🎯" }];
  }, [sportCategories, normalizedPreferredSports]);

  // Auto-select default sport filter
  useEffect(() => {
    if (!hasAppliedPreferredSportDefault && normalizedPreferredSports.length > 0) {
      if (sports.length === 1) {
        setSelectedSport(sports[0].value);
      } else {
        setSelectedSport("all");
      }
      setHasAppliedPreferredSportDefault(true);
    }
  }, [normalizedPreferredSports, sports, hasAppliedPreferredSportDefault]);
  
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

  const cityOptions = useMemo(() => {
    const cities = new Set<string>();
    rescueGames.forEach((game) => game.city && cities.add(game.city));
    quickChallenges.forEach((challenge) => {
      const city = challenge.venues?.city;
      if (city) cities.add(city);
    });
    return ["all", ...Array.from(cities).sort((a, b) => a.localeCompare(b))];
  }, [rescueGames, quickChallenges]);

  const MAX_VISIBLE_CITIES = 10;

  const filteredCityOptions = useMemo(() => {
    const normalizedQuery = citySearchQuery.trim().toLowerCase();
    const matchingCities = cityOptions.filter(
      (city) => city !== "all" && city.toLowerCase().includes(normalizedQuery)
    );

    const visibleCities = showAllCities
      ? matchingCities
      : matchingCities.slice(0, MAX_VISIBLE_CITIES);

    const withAllOption = ["all", ...visibleCities];

    if (selectedCity !== "all" && !withAllOption.includes(selectedCity)) {
      withAllOption.push(selectedCity);
    }

    return withAllOption;
  }, [cityOptions, citySearchQuery, showAllCities, selectedCity]);

  const hasMoreCities = useMemo(() => {
    const normalizedQuery = citySearchQuery.trim().toLowerCase();
    const matchingCount = cityOptions.filter(
      (city) => city !== "all" && city.toLowerCase().includes(normalizedQuery)
    ).length;
    return !showAllCities && matchingCount > MAX_VISIBLE_CITIES;
  }, [cityOptions, citySearchQuery, showAllCities]);

  const activeFiltersCount = [selectedSport !== "all", selectedCourtType !== "all", selectedCity !== "all"].filter(Boolean).length;

  const clearAllFilters = () => {
    setSelectedSport("all");
    setSelectedCourtType("all");
    setSelectedCity("all");
    setCitySearchQuery("");
    setShowAllCities(false);
    setRescuePage(1);
    setChallengePage(1);
  };

  // Reset pages when filters/search change
  useEffect(() => { setRescuePage(1); }, [selectedSport, selectedCourtType, selectedCity, searchQuery]);
  useEffect(() => { setChallengePage(1); }, [selectedSport, selectedCourtType, selectedCity, searchQuery]);


  const FilterPanelBody = (
    <>
      <div className="rounded-2xl border border-border overflow-hidden min-w-0">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="sport" className="border-b border-border">
            <AccordionTrigger className="px-4 py-4 hover:no-underline">
              <span className="font-medium">Sport</span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sports.map((sport) => (
                  <Button
                    key={sport.value}
                    variant={selectedSport === sport.value ? "default" : "outline"}
                    className="justify-start w-full min-w-0"
                    onClick={() => setSelectedSport(sport.value)}
                  >
                    <span className="mr-2">{sport.emoji}</span>
                    <span className="truncate">{sport.label}</span>
                  </Button>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="surface" className="border-b border-border">
            <AccordionTrigger className="px-4 py-4 hover:no-underline">
              <span className="font-medium">Court Surface</span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {courtTypes.map((type) => (
                  <Button
                    key={type.value}
                    variant={selectedCourtType === type.value ? "default" : "outline"}
                    className="justify-start w-full min-w-0"
                    onClick={() => setSelectedCourtType(type.value)}
                  >
                    <span className="mr-2">{type.emoji}</span>
                    <span className="truncate">{type.label}</span>
                  </Button>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="city" className="border-b-0">
            <AccordionTrigger className="px-4 py-4 hover:no-underline">
              <span className="font-medium">City</span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-3">
              <Input
                placeholder="Search city..."
                value={citySearchQuery}
                onChange={(e) => {
                  setCitySearchQuery(e.target.value);
                  setShowAllCities(false);
                }}
                className="h-10 w-full min-w-0"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredCityOptions.map((city) => (
                  <Button
                    key={city}
                    variant={selectedCity === city ? "default" : "outline"}
                    className="justify-start w-full min-w-0"
                    onClick={() => setSelectedCity(city)}
                  >
                    <span className="truncate">{city === "all" ? "All Cities" : city}</span>
                  </Button>
                ))}
              </div>

              {hasMoreCities && (
                <Button variant="ghost" size="sm" onClick={() => setShowAllCities(true)}>
                  Show more cities
                </Button>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-5">
        <Button variant="outline" onClick={() => setShowFilters(false)}>Close</Button>
        <Button onClick={() => setShowFilters(false)}>Apply</Button>
      </div>
    </>
  );

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
            ground_type,
            venues (
              name,
              city
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

        const group = session.groups as {
          name?: string;
          sport_type?: string;
          city?: string;
        } | null;
        const court = session.courts as {
          name?: string;
          ground_type?: string;
          venues?: { name?: string; city?: string } | null;
        } | null;
        
        // If organizer pays (payment_type = 'single'), price is 0 (free for players)
        const isFreeForPlayers = session.payment_type === "single";
        
        rescueGamesData.push({
          id: session.id,
          groupName: group?.name || "Unknown Group",
          sport: (group?.sport_type || "other") as SportType,
          courtName: court?.name || "Court",
          venueName: court?.venues?.name || "Venue",
          city: court?.venues?.city || group?.city || "",
          groundType: court?.ground_type || null,
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

  // Filter rescue games based on sport, preferred sports, and search
  const filteredRescueGames = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return rescueGames.filter((game) => {
      // If explicit sport filter is set, use it; otherwise auto-filter by preferred sports
      const matchesSport =
        selectedSport === "all"
          ? (normalizedPreferredSports.length === 0 || normalizedPreferredSports.includes(game.sport))
          : game.sport === selectedSport;
      const matchesCourtType = selectedCourtType === "all" || game.groundType === selectedCourtType;
      const matchesCity = selectedCity === "all" || game.city === selectedCity;
      const matchesSearch = searchQuery === "" || 
        game.groupName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        game.venueName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        game.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        game.sport.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSport && matchesCourtType && matchesCity && matchesSearch;
    });
  }, [rescueGames, selectedSport, selectedCourtType, selectedCity, searchQuery, normalizedPreferredSports]);

  // Filter quick challenges based on search, preferred sports, gender, and exclude joined
  const filteredChallenges = useMemo(() => {
    const userGender = (profile as any)?.gender as string | null;

    let filtered = quickChallenges.filter((challenge) => {
      // Hide challenges the user has already joined
      if (user && challenge.quick_challenge_players?.some((p) => p.user_id === user.id)) {
        return false;
      }

      // Gender filter: if challenge has a gender preference (male/female), hide from users whose gender doesn't match
      const genderPref = (challenge as any).gender_preference as string | undefined;
      if (genderPref && genderPref !== "mixed" && userGender && userGender !== genderPref) {
        return false;
      }

      return true;
    });
    
    // "all" now means "all of my preferred sports"
    if (selectedSport === "all" && normalizedPreferredSports.length > 0) {
      filtered = filtered.filter((challenge) => {
        const sportName = challenge.sport_categories?.name || "";
        return normalizedPreferredSports.includes(sportName);
      });
    }
    
    if (selectedCourtType !== "all") {
      filtered = filtered.filter((challenge) => challenge.courts?.ground_type === selectedCourtType);
    }

    if (selectedCity !== "all") {
      filtered = filtered.filter((challenge) => challenge.venues?.city === selectedCity);
    }

    if (!searchQuery) return filtered;
    return filtered.filter((challenge) => {
      const sportName = challenge.sport_categories?.display_name?.toLowerCase() || "";
      const venueName = challenge.venues?.name?.toLowerCase() || "";
      const city = challenge.venues?.city?.toLowerCase() || "";
      return sportName.includes(searchQuery.toLowerCase()) ||
             venueName.includes(searchQuery.toLowerCase()) ||
             city.includes(searchQuery.toLowerCase());
    });
  }, [quickChallenges, searchQuery, selectedSport, selectedCourtType, selectedCity, normalizedPreferredSports, profile]);

  // Paginated slices
  const rescueTotalPages = Math.max(1, Math.ceil(filteredRescueGames.length / ITEMS_PER_PAGE));
  const paginatedRescueGames = filteredRescueGames.slice((rescuePage - 1) * ITEMS_PER_PAGE, rescuePage * ITEMS_PER_PAGE);
  const challengeTotalPages = Math.max(1, Math.ceil(filteredChallenges.length / ITEMS_PER_PAGE));
  const paginatedChallenges = filteredChallenges.slice((challengePage - 1) * ITEMS_PER_PAGE, challengePage * ITEMS_PER_PAGE);

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
              Join community games or pick-up games
            </p>
          </div>
          <Button
            onClick={() => setQuickGameModalOpen(true)}
            className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Host pick-up</span>
            <span className="sm:hidden">Host</span>
          </Button>
        </div>

        {/* Info Banner */}
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="p-4 flex items-start gap-3">
            <Zap className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Pick-up Games</p>
              <p className="text-sm text-muted-foreground">
                Find players for instant matches or join community games that need extra players!
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search games, groups, or sports..."
            className="pl-10 h-11 rounded-xl bg-muted/30 border-border/70"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filter Trigger */}
        <div className="flex justify-start">
          <Button variant="outline" className="h-11 rounded-xl gap-2" onClick={() => setShowFilters(true)}>
            <Filter className="h-4 w-4" />
            Filter
            {activeFiltersCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-medium">{activeFiltersCount}</span>
            )}
          </Button>
        </div>

        {isMobile ? (
          <Sheet open={showFilters} onOpenChange={setShowFilters}>
            <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl p-0 flex flex-col overflow-x-hidden">
              <SheetHeader className="p-5 pb-4 border-b border-border">
                <SheetTitle className="flex items-center justify-between">
                  <span>Filters</span>
                  {activeFiltersCount > 0 && (
                    <Button variant="ghost" className="text-primary" onClick={clearAllFilters}>Clear All</Button>
                  )}
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto p-5 pt-3">
                {FilterPanelBody}
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          <Dialog open={showFilters} onOpenChange={setShowFilters}>
            <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl">
              <div className="p-5 border-b border-border flex items-center justify-between">
                <DialogHeader>
                  <DialogTitle>Filters</DialogTitle>
                </DialogHeader>
                {activeFiltersCount > 0 && (
                  <Button variant="ghost" className="text-primary" onClick={clearAllFilters}>Clear All</Button>
                )}
              </div>

              <div className="p-5 pt-3">
                {FilterPanelBody}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="rescue" className="relative gap-2">
              <AlertTriangle className="h-4 w-4" />
              Community Games
              {filteredRescueGames.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-warning text-warning-foreground rounded-full text-xs font-bold">
                  {filteredRescueGames.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="quickgames" className="gap-2">
              <Zap className="h-4 w-4" />
              Pick-up Games
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
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {paginatedRescueGames.map((game) => (
                    <GameCard key={game.id} {...game} />
                  ))}
                </div>
                {rescueTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 mt-6">
                    <Button variant="outline" size="icon" disabled={rescuePage <= 1} onClick={() => setRescuePage((p) => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {rescuePage} of {rescueTotalPages}
                    </span>
                    <Button variant="outline" size="icon" disabled={rescuePage >= rescueTotalPages} onClick={() => setRescuePage((p) => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="h-8 w-8 opacity-50" />
                </div>
                <p className="font-medium">No community games found</p>
                <p className="text-sm mt-1">
                  {selectedSport !== "all" 
                    ? `Try selecting a different sport or clear filters`
                    : "Check back later for games that need players"}
                </p>
                {selectedSport !== "all" && (
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={clearAllFilters}
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
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {paginatedChallenges.map((challenge) => (
                    <QuickChallengeSummaryCard
                      key={challenge.id}
                      challenge={{
                        id: challenge.id,
                        sportName: challenge.sport_categories?.display_name,
                        sportIcon: challenge.sport_categories?.icon || "🎯",
                        gameMode: challenge.game_mode,
                        status: challenge.status,
                        venueName: challenge.venues?.name,
                        venueAddress: challenge.venues?.address,
                        scheduledDate: challenge.scheduled_date || undefined,
                        scheduledTime: challenge.scheduled_time || undefined,
                        courtImage: challenge.courts?.photo_url || challenge.venues?.photo_url || "/placeholder.svg",
                        pricePerPlayer: challenge.price_per_player,
                        totalPrice: challenge.price_per_player,
                        totalSlots: challenge.total_slots,
                        playersCount: challenge.quick_challenge_players?.length || 0,
                      }}
                      onSelect={() => navigate(`/quick-games/${challenge.id}`)}
                    />
                  ))}
                </div>
                {challengeTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 mt-6">
                    <Button variant="outline" size="icon" disabled={challengePage <= 1} onClick={() => setChallengePage((p) => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {challengePage} of {challengeTotalPages}
                    </span>
                    <Button variant="outline" size="icon" disabled={challengePage >= challengeTotalPages} onClick={() => setChallengePage((p) => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-8 w-8 opacity-50" />
                </div>
                <p className="font-medium">No pick-up games yet</p>
                <p className="text-sm mt-1">
                  Be the first to host a pick-up game!
                </p>
                <Button 
                  className="mt-4 gap-2"
                  onClick={() => setQuickGameModalOpen(true)}
                >
                  <Zap className="h-4 w-4" />
                  Host pick-up
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
