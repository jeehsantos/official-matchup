import { useState, useEffect, useRef, useCallback } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { CourtCard } from "@/components/courts/CourtCard";
import { CourtsMap } from "@/components/courts/CourtsMap";
import { CourtsPagination } from "@/components/courts/CourtsPagination";
import { MobileCourtSheet } from "@/components/courts/MobileCourtSheet";
import { Search, MapPin, SlidersHorizontal, Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Database } from "@/integrations/supabase/types";

type Court = Database["public"]["Tables"]["courts"]["Row"];
type Venue = Database["public"]["Tables"]["venues"]["Row"];

interface CourtWithVenue extends Court {
  venues: Venue | null;
}

const groundTypeFilters = ["all", "grass", "turf", "sand", "hard", "clay", "other"] as const;
const ITEMS_PER_PAGE = 9;

// Ground type filter data with emojis
const groundTypeData: Record<string, { emoji: string; label: string }> = {
  all: { emoji: "🎯", label: "All Surfaces" },
  grass: { emoji: "🌱", label: "Grass" },
  turf: { emoji: "🟩", label: "Turf" },
  sand: { emoji: "🏖️", label: "Sand" },
  hard: { emoji: "🟫", label: "Hard Court" },
  clay: { emoji: "🟠", label: "Clay" },
  other: { emoji: "⚪", label: "Other" },
};

export default function Courts() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [courts, setCourts] = useState<CourtWithVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroundType, setSelectedGroundType] = useState<string>("all");
  const [selectedVenueType, setSelectedVenueType] = useState<"all" | "indoor" | "outdoor">("all");
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
    
    const matchesGroundType = selectedGroundType === "all" || court.ground_type === selectedGroundType;
    const matchesVenueType = 
      selectedVenueType === "all" ||
      (selectedVenueType === "indoor" && court.is_indoor) ||
      (selectedVenueType === "outdoor" && !court.is_indoor);
    const matchesCity = selectedCity === "all" || court.venues?.city === selectedCity;

    return matchesSearch && matchesGroundType && matchesVenueType && matchesCity;
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
  }, [searchQuery, selectedGroundType, selectedVenueType, selectedCity]);

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

  // Desktop Filter bar component with dropdowns
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

      {/* Filter Dropdowns Row */}
      <div className="flex flex-wrap gap-3">
        {/* Ground Type Dropdown */}
        <Select value={selectedGroundType} onValueChange={setSelectedGroundType}>
          <SelectTrigger className="w-[160px] h-10">
            <SelectValue>
              <div className="flex items-center gap-2">
                <span>{groundTypeData[selectedGroundType]?.emoji || "🎯"}</span>
                <span>{groundTypeData[selectedGroundType]?.label || "All Surfaces"}</span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border shadow-lg z-50">
            {groundTypeFilters.map((groundType) => {
              const data = groundTypeData[groundType];
              return (
                <SelectItem key={groundType} value={groundType}>
                  <div className="flex items-center gap-2">
                    <span>{data?.emoji || "🎯"}</span>
                    <span>{data?.label || groundType}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Indoor/Outdoor Dropdown */}
        <Select value={selectedVenueType} onValueChange={(val) => setSelectedVenueType(val as "all" | "indoor" | "outdoor")}>
          <SelectTrigger className="w-[140px] h-10">
            <SelectValue>
              <div className="flex items-center gap-2">
                <span>{selectedVenueType === "all" ? "🏟️" : selectedVenueType === "indoor" ? "🏢" : "🌳"}</span>
                <span>{selectedVenueType === "all" ? "All Types" : selectedVenueType === "indoor" ? "Indoor" : "Outdoor"}</span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border shadow-lg z-50">
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <span>🏟️</span>
                <span>All Types</span>
              </div>
            </SelectItem>
            <SelectItem value="indoor">
              <div className="flex items-center gap-2">
                <span>🏢</span>
                <span>Indoor</span>
              </div>
            </SelectItem>
            <SelectItem value="outdoor">
              <div className="flex items-center gap-2">
                <span>🌳</span>
                <span>Outdoor</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        {/* City Dropdown */}
        {cities.length > 0 && (
          <Select value={selectedCity} onValueChange={setSelectedCity}>
            <SelectTrigger className="w-[160px] h-10">
              <SelectValue>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{selectedCity === "all" ? "All Cities" : selectedCity}</span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-popover border border-border shadow-lg z-50">
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>All Cities</span>
                </div>
              </SelectItem>
              {cities.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
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
        <div className="fixed inset-0 top-0 bottom-16 overflow-hidden">
          {/* Full-screen map - lowest z-index */}
          <div className="absolute inset-0 top-20 z-0">
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
                    <CourtCard
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
