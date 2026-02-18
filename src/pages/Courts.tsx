import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { CourtCard } from "@/components/courts/CourtCard";
import { CourtsMap } from "@/components/courts/CourtsMap";
import { CourtsPagination } from "@/components/courts/CourtsPagination";
import { MobileCourtSheet } from "@/components/courts/MobileCourtSheet";
import { MobileCourtFilters } from "@/components/courts/MobileCourtFilters";
import { Button } from "@/components/ui/button";
import { Search, MapPin, SlidersHorizontal, Building2, Loader2, Zap, X, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSurfaceTypes } from "@/hooks/useSurfaceTypes";
import { usePaginationThreshold } from "@/hooks/usePaginationThreshold";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useSportCategories } from "@/hooks/useSportCategories";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { Database } from "@/integrations/supabase/types";

type Court = Database["public"]["Tables"]["courts"]["Row"];
type Venue = Database["public"]["Tables"]["venues"]["Row"];

interface CourtWithVenue extends Court {
  venues: Venue | null;
}

export default function Courts() {
  const { user } = useAuth();
  const { preferredSports } = useUserProfile();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const itemsPerPage = usePaginationThreshold();
  const [courts, setCourts] = useState<CourtWithVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroundType, setSelectedGroundType] = useState<string>("all");
  const [selectedVenueType, setSelectedVenueType] = useState<"all" | "indoor" | "outdoor">("all");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [selectedSport, setSelectedSport] = useState<string>("all");
  const [hasAppliedPreferredSportDefault, setHasAppliedPreferredSportDefault] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [highlightedCourtId, setHighlightedCourtId] = useState<string | null>(null);
  const [showPagination, setShowPagination] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showDesktopFilters, setShowDesktopFilters] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Check for quick game mode
  const isQuickGameMode = searchParams.get("quickGame") === "true";
  const quickGameSport = searchParams.get("sport");
  
  // Get quick game config from sessionStorage
  const quickGameConfig = useMemo(() => {
    if (!isQuickGameMode) return null;
    try {
      const stored = sessionStorage.getItem("quickGameConfig");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, [isQuickGameMode]);
  
  // Handle exiting quick game mode
  const handleExitQuickGame = () => {
    sessionStorage.removeItem("quickGameConfig");
    navigate("/courts", { replace: true });
  };

  // Fetch surface and sport types from database - NO FALLBACKS
  const { data: surfaceTypes = [] } = useSurfaceTypes();
  const { data: sportCategories = [], isLoading: loadingSports } = useSportCategories();

  // Build ground type data from database
  const groundTypeData = useMemo(() => {
    const data: Record<string, { emoji: string; label: string }> = {
      all: { emoji: "🎯", label: "All Surfaces" },
    };
    surfaceTypes.forEach(surface => {
      data[surface.name] = {
        emoji: surface.name === "grass" ? "🌱" : 
               surface.name === "turf" ? "🟩" :
               surface.name === "sand" ? "🏖️" :
               surface.name === "hard" ? "🟫" :
               surface.name === "clay" ? "🟠" : "⚪",
        label: surface.display_name,
      };
    });
    return data;
  }, [surfaceTypes]);

  // Build ground type filters from database
  const groundTypeFilters = useMemo(() => {
    return ["all", ...surfaceTypes.map(s => s.name)];
  }, [surfaceTypes]);

  // Build sport filter options from user's preferred sports only
  const sportFilterOptions = useMemo(() => {
    const preferredSportSet = new Set(preferredSports);
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

    // Fallback: no preferred sports (shouldn't happen with profile gate)
    return [{ value: "all", label: "All Sports", emoji: "🎯" }];
  }, [sportCategories, preferredSports]);

  // Auto-select default sport filter
  useEffect(() => {
    if (!hasAppliedPreferredSportDefault && preferredSports.length > 0) {
      if (sportFilterOptions.length === 1) {
        setSelectedSport(sportFilterOptions[0].value);
      } else {
        setSelectedSport("all");
      }
      setHasAppliedPreferredSportDefault(true);
    }
  }, [preferredSports, sportFilterOptions, hasAppliedPreferredSportDefault]);

  useEffect(() => {
    fetchCourts();
  }, []);

  // Fetch all courts including sub-courts (for filtering by sub-court properties)
  const [allVenueCourts, setAllVenueCourts] = useState<CourtWithVenue[]>([]);
  
  const fetchCourts = async () => {
    try {
      // Fetch all courts (main + sub) for filtering purposes
      const { data: allCourts, error: allError } = await supabase
        .from("courts")
        .select(`
          *,
          venues (*)
        `)
        .eq("is_active", true);

      if (allError) throw allError;
      
      setAllVenueCourts(allCourts as CourtWithVenue[] || []);
      
      // Only show parent courts in the list
      const parentCourts = (allCourts as CourtWithVenue[] || []).filter(c => !c.parent_court_id);
      setCourts(parentCourts);
      
      const uniqueCities = [...new Set(
        parentCourts
          .map(c => c.venues?.city)
          .filter(Boolean)
      )] as string[];
      setCities(uniqueCities);
    } catch (error) {
      console.error("Error fetching courts:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCourts = courts.filter(court => {
    const matchesSearch = 
      court.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      court.venues?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      court.venues?.city.toLowerCase().includes(searchQuery.toLowerCase());
    
    // For ground type filter, check if any court at this venue (including sub-courts) matches
    const venueId = court.venue_id;
    const venueCourts = allVenueCourts.filter(c => c.venue_id === venueId);
    const matchesGroundType = selectedGroundType === "all" || 
      venueCourts.some(c => c.ground_type === selectedGroundType);
    
    // For venue type filter, also check sub-courts
    const matchesVenueType = 
      selectedVenueType === "all" ||
      (selectedVenueType === "indoor" && venueCourts.some(c => c.is_indoor)) ||
      (selectedVenueType === "outdoor" && venueCourts.some(c => !c.is_indoor));
    
    const matchesCity = selectedCity === "all" || court.venues?.city === selectedCity;

    const sportMatchesForCourt = (sportName: string) =>
      venueCourts.some(c =>
        c.sport_type === sportName ||
        (c.allowed_sports && c.allowed_sports.includes(sportName))
      );

    // "all" now means "all of my preferred sports"
    const matchesSport =
      selectedSport === "all"
        ? (preferredSports.length === 0 || preferredSports.some((sport) => sportMatchesForCourt(sport)))
        : sportMatchesForCourt(selectedSport);

    return matchesSearch && matchesGroundType && matchesVenueType && matchesCity && matchesSport;
  });

  // Pagination (desktop only)
  const totalPages = Math.ceil(filteredCourts.length / itemsPerPage);
  const paginatedCourts = filteredCourts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedGroundType, selectedVenueType, selectedCity, selectedSport]);

  // Scroll detection for pagination visibility
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollPercentage = 
      (container.scrollTop / (container.scrollHeight - container.clientHeight)) * 100;
    
    setShowPagination(scrollPercentage >= 80 || container.scrollHeight <= container.clientHeight);
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll, paginatedCourts]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Calculate active filters count
  const activeFiltersCount = [
    selectedGroundType !== "all",
    selectedVenueType !== "all",
    selectedCity !== "all",
    selectedSport !== "all",
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setSelectedGroundType("all");
    setSelectedVenueType("all");
    setSelectedCity("all");
    setSelectedSport("all");
  };

  const Layout = user ? MobileLayout : PublicLayout;

  // Quick Game Mode Banner
  const QuickGameBanner = () => {
    if (!isQuickGameMode || !quickGameConfig) return null;
    
    return (
      <div className="bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 rounded-lg p-3 sm:p-4 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm sm:text-base truncate">Quick Challenge Mode</h3>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {quickGameConfig.sportName} • {quickGameConfig.gameMode} ({quickGameConfig.totalPlayers} players)
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleExitQuickGame}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Select a court and time slot to create your quick challenge session
        </p>
      </div>
    );
  };

  // Desktop Filter bar component with dialog filters
  const FilterBar = () => (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <div className="flex items-center gap-3 bg-card border border-border rounded-full px-4 py-3 shadow-sm hover:shadow-md transition-shadow">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search courts, venues, or cities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="h-5 w-5 rounded-full bg-muted flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
            >
              <span className="text-xs text-muted-foreground">✕</span>
            </button>
          )}
        </div>
      </div>

      <div>
        <Button variant="outline" className="h-11 rounded-xl gap-2" onClick={() => setShowDesktopFilters(true)}>
          <Filter className="h-4 w-4" />
          Filter
          {activeFiltersCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-medium">{activeFiltersCount}</span>
          )}
        </Button>
      </div>

      <Dialog open={showDesktopFilters} onOpenChange={setShowDesktopFilters}>
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
            <div className="rounded-2xl border border-border overflow-hidden">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="surface" className="border-b border-border">
                  <AccordionTrigger className="px-4 py-4 hover:no-underline"><span className="font-medium">Surface Type</span></AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="grid grid-cols-2 gap-2">
                      {groundTypeFilters.map((groundType) => {
                        const data = groundTypeData[groundType];
                        return (
                          <Button
                            key={groundType}
                            variant={selectedGroundType === groundType ? "default" : "outline"}
                            className="justify-start"
                            onClick={() => setSelectedGroundType(groundType)}
                          >
                            <span className="mr-2">{data?.emoji || "🎯"}</span>
                            {data?.label || groundType}
                          </Button>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="venue" className="border-b border-border">
                  <AccordionTrigger className="px-4 py-4 hover:no-underline"><span className="font-medium">Indoor / Outdoor</span></AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="grid grid-cols-3 gap-2">
                      {[{ value: "all", label: "All", emoji: "🏟️" }, { value: "indoor", label: "Indoor", emoji: "🏢" }, { value: "outdoor", label: "Outdoor", emoji: "🌳" }].map((type) => (
                        <Button
                          key={type.value}
                          variant={selectedVenueType === type.value ? "default" : "outline"}
                          className="justify-start"
                          onClick={() => setSelectedVenueType(type.value as "all" | "indoor" | "outdoor")}
                        >
                          <span className="mr-2">{type.emoji}</span>
                          {type.label}
                        </Button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="sport" className="border-b border-border">
                  <AccordionTrigger className="px-4 py-4 hover:no-underline"><span className="font-medium">Sport</span></AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="grid grid-cols-2 gap-2">
                      {sportFilterOptions.map((sport) => (
                        <Button
                          key={sport.value}
                          variant={selectedSport === sport.value ? "default" : "outline"}
                          className="justify-start"
                          onClick={() => setSelectedSport(sport.value)}
                        >
                          <span className="mr-2">{sport.emoji}</span>
                          {sport.label}
                        </Button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="city" className="border-b-0">
                  <AccordionTrigger className="px-4 py-4 hover:no-underline"><span className="font-medium">City</span></AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant={selectedCity === "all" ? "default" : "outline"} className="justify-start" onClick={() => setSelectedCity("all")}>All Cities</Button>
                      {cities.map((city) => (
                        <Button key={city} variant={selectedCity === city ? "default" : "outline"} className="justify-start" onClick={() => setSelectedCity(city)}>{city}</Button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <Button variant="outline" onClick={() => setShowDesktopFilters(false)}>Close</Button>
              <Button onClick={() => setShowDesktopFilters(false)}>Apply</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  // Loading skeleton
  const LoadingSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-[4/3] bg-muted rounded-xl mb-3" />
          <div className="h-5 bg-muted rounded w-3/4 mb-2" />
          <div className="h-4 bg-muted rounded w-1/2 mb-2" />
          <div className="h-4 bg-muted rounded w-1/4" />
        </div>
      ))}
    </div>
  );

  // Empty state
  const EmptyState = () => (
    <div className="text-center py-12">
      <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <h3 className="font-semibold text-lg mb-2">No Courts Found</h3>
      <p className="text-muted-foreground">
        {courts.length === 0 
          ? "No courts have been registered yet. Check back soon!"
          : "Try adjusting your filters or search query."}
      </p>
    </div>
  );

  // Mobile/Tablet Layout
  if (isMobile) {
    return (
      <MobileLayout showHeader={false} showBottomNav={true}>
        <div className="fixed inset-0 top-0 bottom-16 overflow-hidden">
          {/* Full-screen map - lowest z-index */}
          <div className="absolute inset-0 top-20 z-0">
            <CourtsMap
              courts={filteredCourts}
              highlightedCourtId={highlightedCourtId}
              onMarkerHover={setHighlightedCourtId}
              linkSearch={location.search}
            />
          </div>

          {/* Quick Game Banner for mobile */}
          {isQuickGameMode && quickGameConfig && (
            <div className="absolute top-20 left-4 right-4 z-[500] pointer-events-auto">
              <QuickGameBanner />
            </div>
          )}

          {/* Floating search header - above map */}
          <div className={`absolute ${isQuickGameMode ? "top-44" : "top-4"} left-4 right-4 z-[500] pointer-events-none`}>
            <div className="flex items-center gap-2 bg-background rounded-full px-4 py-3 shadow-lg border border-border pointer-events-auto">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Search courts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground min-w-0"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
              />
              {searchQuery ? (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0"
                >
                  <span className="text-xs">✕</span>
                </button>
              ) : (
                <button 
                  onClick={() => setShowMobileFilters(true)}
                  className="h-8 w-8 rounded-full bg-muted flex items-center justify-center relative shrink-0"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  {activeFiltersCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-primary-foreground rounded-full text-[10px] flex items-center justify-center font-medium">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Draggable bottom sheet with cards - highest z-index via portal */}
          <MobileCourtSheet
            courts={filteredCourts}
            loading={loading}
            highlightedCourtId={highlightedCourtId}
            onHighlight={setHighlightedCourtId}
          />

          {/* Mobile Filters Sheet */}
          <MobileCourtFilters
            open={showMobileFilters}
            onOpenChange={setShowMobileFilters}
            selectedGroundType={selectedGroundType}
            setSelectedGroundType={setSelectedGroundType}
            selectedVenueType={selectedVenueType}
            setSelectedVenueType={setSelectedVenueType}
            selectedCity={selectedCity}
            setSelectedCity={setSelectedCity}
            cities={cities}
            activeFiltersCount={activeFiltersCount}
            surfaceTypes={surfaceTypes}
            selectedSport={selectedSport}
            setSelectedSport={setSelectedSport}
            sportOptions={sportFilterOptions}
            loadingSports={loadingSports}
          />
        </div>
      </MobileLayout>
    );
  }

  // Desktop Layout
  return (
    <Layout>
      <div className="flex flex-col lg:flex-row h-[calc(100vh-3.5rem)]">
        {/* Left Panel - Court List */}
        <div 
          ref={scrollContainerRef}
          className="w-full lg:w-[55%] xl:w-[60%] overflow-y-auto lg:scrollbar-hide"
        >
          <div className="p-4 lg:p-6 space-y-4">
            {/* Quick Game Banner */}
            <QuickGameBanner />
            
            {/* Header */}
            <div id="browse-courts" className="scroll-mt-24 flex items-center justify-between">
              <div>
                <h1 className="font-display text-2xl font-bold">
                  {isQuickGameMode ? "Select a Court" : "Browse Courts"}
                </h1>
                <p className="text-muted-foreground text-sm">
                  {filteredCourts.length} court{filteredCourts.length !== 1 ? "s" : ""} available
                </p>
              </div>
            </div>

            <FilterBar />

            {/* Courts Grid */}
            {loading ? (
              <LoadingSkeleton />
            ) : filteredCourts.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {paginatedCourts.map((court) => (
                    <div key={court.id} className="relative">
                      <CourtCard
                        court={court}
                        onHover={setHighlightedCourtId}
                        isHighlighted={court.id === highlightedCourtId}
                      />
                      {/* Multi-court badge */}
                      {(court as any).is_multi_court && (
                        <Badge className="absolute top-2 left-2 bg-accent text-accent-foreground">
                          Multi-Court
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                <CourtsPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                  totalItems={filteredCourts.length}
                  itemsPerPage={itemsPerPage}
                  isVisible={showPagination}
                />
              </>
            )}
          </div>
        </div>

        {/* Right Panel - Map */}
        <div className="hidden lg:block w-[45%] xl:w-[40%] h-auto sticky top-0 p-6 pt-[170px]">
          <div className="h-[calc(100vh-170px-48px)] rounded-2xl overflow-hidden shadow-sm border border-border bg-muted">
            <CourtsMap
              courts={filteredCourts}
              highlightedCourtId={highlightedCourtId}
              onMarkerHover={setHighlightedCourtId}
              linkSearch={location.search}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}
