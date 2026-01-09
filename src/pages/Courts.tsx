import { useState, useEffect, useRef, useCallback } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { CourtCardAirbnb } from "@/components/courts/CourtCardAirbnb";
import { CourtsMap } from "@/components/courts/CourtsMap";
import { CourtsPagination } from "@/components/courts/CourtsPagination";
import { MobileCourtSheet } from "@/components/courts/MobileCourtSheet";
import { Search, MapPin, SlidersHorizontal, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Database } from "@/integrations/supabase/types";

type Court = Database["public"]["Tables"]["courts"]["Row"];
type Venue = Database["public"]["Tables"]["venues"]["Row"];

interface CourtWithVenue extends Court {
  venues: Venue | null;
}

const sportFilters = ["all", "futsal", "basketball", "tennis", "volleyball", "badminton", "turf_hockey"] as const;
const ITEMS_PER_PAGE = 9;

export default function Courts() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [courts, setCourts] = useState<CourtWithVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSport, setSelectedSport] = useState<string>("all");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [cities, setCities] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [highlightedCourtId, setHighlightedCourtId] = useState<string | null>(null);
  const [showPagination, setShowPagination] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCourts();
  }, []);

  const fetchCourts = async () => {
    try {
      const { data, error } = await supabase
        .from("courts")
        .select(`
          *,
          venues (*)
        `)
        .eq("is_active", true);

      if (error) throw error;

      setCourts(data as CourtWithVenue[] || []);
      
      const uniqueCities = [...new Set(
        (data as CourtWithVenue[] || [])
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
    
    const matchesSport = selectedSport === "all" || court.sport_type === selectedSport;
    const matchesCity = selectedCity === "all" || court.venues?.city === selectedCity;

    return matchesSearch && matchesSport && matchesCity;
  });

  // Pagination (desktop only)
  const totalPages = Math.ceil(filteredCourts.length / ITEMS_PER_PAGE);
  const paginatedCourts = filteredCourts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedSport, selectedCity]);

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

  const Layout = user ? MobileLayout : PublicLayout;

  // Sport filter data with emojis
  const sportData = {
    all: { emoji: "🎯", label: "All" },
    futsal: { emoji: "⚽", label: "Futsal" },
    basketball: { emoji: "🏀", label: "Basketball" },
    tennis: { emoji: "🎾", label: "Tennis" },
    volleyball: { emoji: "🏐", label: "Volleyball" },
    badminton: { emoji: "🏸", label: "Badminton" },
    turf_hockey: { emoji: "🏑", label: "Hockey" },
  };

  // Desktop Filter bar component
  const FilterBar = () => (
    <div className="space-y-6">
      {/* Search Bar - Airbnb style pill */}
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

      {/* Sport Category Tabs - Icon-focused Airbnb style */}
      <div className="flex gap-1 overflow-x-auto pb-3 scrollbar-hide -mx-6 px-6">
        {sportFilters.map((sport) => {
          const isActive = selectedSport === sport;
          const data = sportData[sport as keyof typeof sportData];
          
          return (
            <button
              key={sport}
              onClick={() => setSelectedSport(sport)}
              className={`flex flex-col items-center gap-2 px-4 py-3 min-w-[72px] shrink-0 border-b-2 transition-all ${
                isActive 
                  ? "border-foreground text-foreground" 
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              }`}
            >
              <span className="text-2xl">{data?.emoji || "🎯"}</span>
              <span className="text-xs font-medium whitespace-nowrap">
                {data?.label || sport.replace("_", " ")}
              </span>
            </button>
          );
        })}
      </div>

      {/* City Filter - Clean pill chips */}
      {cities.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-6 px-6">
          <button
            onClick={() => setSelectedCity("all")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium shrink-0 transition-all ${
              selectedCity === "all"
                ? "bg-foreground text-background"
                : "bg-card border border-border text-foreground hover:border-foreground"
            }`}
          >
            <MapPin className="h-3.5 w-3.5" />
            All Cities
          </button>
          {cities.map((city) => (
            <button
              key={city}
              onClick={() => setSelectedCity(city)}
              className={`px-4 py-2 rounded-full text-sm font-medium shrink-0 transition-all ${
                selectedCity === city
                  ? "bg-foreground text-background"
                  : "bg-card border border-border text-foreground hover:border-foreground"
              }`}
            >
              {city}
            </button>
          ))}
        </div>
      )}
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

  // Mobile/Tablet: Floating search header
  const MobileSearchHeader = () => (
    <div className="absolute top-4 left-4 right-4 z-[1000]">
      <div className="flex items-center gap-2 bg-background rounded-full px-4 py-3 shadow-lg border border-border">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          placeholder="Search courts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground min-w-0"
        />
        {searchQuery ? (
          <button 
            onClick={() => setSearchQuery("")}
            className="h-6 w-6 rounded-full bg-muted flex items-center justify-center"
          >
            <span className="text-xs">✕</span>
          </button>
        ) : (
          <button className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );

  // Mobile/Tablet Layout
  if (isMobile) {
    // For mobile courts view, we use MobileLayout with header hidden for full-screen map
    return (
      <MobileLayout showHeader={false} showBottomNav={true}>
        <div className="fixed inset-0 top-0 bottom-0 overflow-hidden">
          {/* Full-screen map - lowest z-index */}
          <div className="absolute inset-0 z-0">
            <CourtsMap
              courts={filteredCourts}
              highlightedCourtId={highlightedCourtId}
              onMarkerHover={setHighlightedCourtId}
            />
          </div>

          {/* Floating search header - above map */}
          <div className="absolute top-4 left-4 right-4 z-[500]">
            <div className="flex items-center gap-2 bg-background rounded-full px-4 py-3 shadow-lg border border-border">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Search courts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground min-w-0"
              />
              {searchQuery ? (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="h-6 w-6 rounded-full bg-muted flex items-center justify-center"
                >
                  <span className="text-xs">✕</span>
                </button>
              ) : (
                <button className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <SlidersHorizontal className="h-4 w-4" />
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
          className="w-full lg:w-[55%] xl:w-[60%] overflow-y-auto"
        >
          <div className="p-4 lg:p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-display text-2xl font-bold">Browse Courts</h1>
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
                    <CourtCardAirbnb
                      key={court.id}
                      court={court}
                      onHover={setHighlightedCourtId}
                      isHighlighted={court.id === highlightedCourtId}
                    />
                  ))}
                </div>

                {/* Pagination */}
                <CourtsPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                  totalItems={filteredCourts.length}
                  itemsPerPage={ITEMS_PER_PAGE}
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
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}
