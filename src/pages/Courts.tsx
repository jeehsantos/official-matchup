import { useState, useEffect, useRef, useCallback } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SportIcon } from "@/components/ui/sport-icon";
import { CourtCardAirbnb } from "@/components/courts/CourtCardAirbnb";
import { CourtsMap } from "@/components/courts/CourtsMap";
import { CourtsPagination } from "@/components/courts/CourtsPagination";
import { 
  Search, 
  MapPin, 
  SlidersHorizontal,
  Building2,
  Map,
  List
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
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
  const [courts, setCourts] = useState<CourtWithVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSport, setSelectedSport] = useState<string>("all");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [cities, setCities] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [highlightedCourtId, setHighlightedCourtId] = useState<string | null>(null);
  const [showPagination, setShowPagination] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  
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

  // Pagination
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
    // Check initial state
    handleScroll();

    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll, paginatedCourts]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Use different layout based on auth
  const Layout = user ? MobileLayout : PublicLayout;

  // Filter bar component
  const FilterBar = () => (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search courts, venues, cities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-card"
        />
      </div>

      {/* Sport Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {sportFilters.map((sport) => (
          <Button
            key={sport}
            variant={selectedSport === sport ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedSport(sport)}
            className="shrink-0 capitalize"
          >
            {sport === "all" ? "All Sports" : (
              <span className="flex items-center gap-1.5">
                <SportIcon sport={sport as any} className="h-4 w-4" />
                {sport.replace("_", " ")}
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* City Filter */}
      {cities.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <Button
            variant={selectedCity === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSelectedCity("all")}
            className="shrink-0"
          >
            <MapPin className="h-4 w-4 mr-1" />
            All Cities
          </Button>
          {cities.map((city) => (
            <Button
              key={city}
              variant={selectedCity === city ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setSelectedCity(city)}
              className="shrink-0"
            >
              {city}
            </Button>
          ))}
        </div>
      )}
    </div>
  );

  // Mobile view toggle
  const MobileViewToggle = () => (
    <div className="lg:hidden flex gap-2 pb-4">
      <Button
        variant={mobileView === "list" ? "default" : "outline"}
        size="sm"
        onClick={() => setMobileView("list")}
        className="flex-1"
      >
        <List className="h-4 w-4 mr-2" />
        List
      </Button>
      <Button
        variant={mobileView === "map" ? "default" : "outline"}
        size="sm"
        onClick={() => setMobileView("map")}
        className="flex-1"
      >
        <Map className="h-4 w-4 mr-2" />
        Map
      </Button>
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

  return (
    <Layout>
      <div className="flex flex-col lg:flex-row h-[calc(100vh-3.5rem)]">
        {/* Left Panel - Court List */}
        <div 
          ref={scrollContainerRef}
          className={`w-full lg:w-[55%] xl:w-[60%] overflow-y-auto ${
            mobileView === "map" ? "hidden lg:block" : ""
          }`}
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
              <Button variant="outline" size="sm" className="hidden sm:flex">
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </div>

            <FilterBar />
            <MobileViewToggle />

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
        <div 
          className={`w-full lg:w-[45%] xl:w-[40%] h-[50vh] lg:h-auto lg:sticky lg:top-0 p-4 lg:p-6 lg:pt-[170px] ${
            mobileView === "list" ? "hidden lg:block" : ""
          }`}
        >
          <div className="h-full lg:h-[calc(100vh-170px-48px)] rounded-2xl overflow-hidden shadow-sm border border-border bg-muted">
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
