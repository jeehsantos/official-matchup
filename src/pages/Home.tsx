import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  Search, 
  MapPin, 
  Star,
  Heart,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Users,
  Calendar,
  User
} from "lucide-react";

type SportType = "futsal" | "tennis" | "volleyball" | "basketball" | "turf_hockey" | "badminton" | "hockey" | "other";

interface Court {
  id: string;
  name: string;
  venueName: string;
  address: string;
  city: string;
  sport: SportType;
  hourlyRate: number;
  rating: number;
  reviewCount: number;
  images: string[];
  isIndoor: boolean;
  isFavorite: boolean;
  capacity: number;
}

// Demo court data with multiple images
const courtsData: Court[] = [
  {
    id: "c1",
    name: "Indoor Futsal Court A",
    venueName: "Auckland Sports Center",
    address: "123 Sports Ave",
    city: "Auckland CBD",
    sport: "futsal",
    hourlyRate: 85,
    rating: 4.8,
    reviewCount: 124,
    images: [
      "https://images.unsplash.com/photo-1577223625816-7546f13df25d?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&h=600&fit=crop",
    ],
    isIndoor: true,
    isFavorite: false,
    capacity: 14,
  },
  {
    id: "c2",
    name: "Tennis Court 1",
    venueName: "Takapuna Tennis Club",
    address: "45 Beach Road",
    city: "Takapuna",
    sport: "tennis",
    hourlyRate: 40,
    rating: 4.6,
    reviewCount: 89,
    images: [
      "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=800&h=600&fit=crop",
    ],
    isIndoor: false,
    isFavorite: true,
    capacity: 4,
  },
  {
    id: "c3",
    name: "Basketball Court",
    venueName: "Albany Recreation Center",
    address: "78 Albany Highway",
    city: "Albany",
    sport: "basketball",
    hourlyRate: 60,
    rating: 4.5,
    reviewCount: 67,
    images: [
      "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=800&h=600&fit=crop",
    ],
    isIndoor: true,
    isFavorite: false,
    capacity: 10,
  },
  {
    id: "c4",
    name: "Volleyball Hall",
    venueName: "North Shore Sports Hub",
    address: "22 Stadium Drive",
    city: "North Shore",
    sport: "volleyball",
    hourlyRate: 55,
    rating: 4.7,
    reviewCount: 45,
    images: [
      "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1592656094267-764a45160876?w=800&h=600&fit=crop",
    ],
    isIndoor: true,
    isFavorite: false,
    capacity: 12,
  },
  {
    id: "c5",
    name: "Badminton Courts",
    venueName: "Parnell Badminton Club",
    address: "15 Parnell Rise",
    city: "Parnell",
    sport: "badminton",
    hourlyRate: 35,
    rating: 4.9,
    reviewCount: 156,
    images: [
      "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&h=600&fit=crop",
    ],
    isIndoor: true,
    isFavorite: true,
    capacity: 4,
  },
  {
    id: "c6",
    name: "Outdoor Futsal Pitch",
    venueName: "Mission Bay Sports",
    address: "88 Tamaki Drive",
    city: "Mission Bay",
    sport: "futsal",
    hourlyRate: 65,
    rating: 4.4,
    reviewCount: 78,
    images: [
      "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=600&fit=crop",
    ],
    isIndoor: false,
    isFavorite: false,
    capacity: 14,
  },
];

const sportCategories = [
  { value: "all", label: "All", icon: "🎯" },
  { value: "futsal", label: "Futsal", icon: "⚽" },
  { value: "basketball", label: "Basketball", icon: "🏀" },
  { value: "tennis", label: "Tennis", icon: "🎾" },
  { value: "volleyball", label: "Volleyball", icon: "🏐" },
  { value: "badminton", label: "Badminton", icon: "🏸" },
];

// Image Carousel Component (Airbnb style)
function ImageCarousel({ images, onImageClick }: { images: string[]; onImageClick: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  const goToPrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goToNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="relative aspect-square overflow-hidden rounded-xl group cursor-pointer" onClick={onImageClick}>
      <img
        src={images[currentIndex]}
        alt=""
        className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setIsLoaded(true)}
      />
      {!isLoaded && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      
      {/* Navigation arrows - show on hover */}
      {images.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="h-4 w-4 text-gray-800" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="h-4 w-4 text-gray-800" />
          </button>
        </>
      )}

      {/* Dots indicator */}
      {images.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {images.map((_, idx) => (
            <div
              key={idx}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                idx === currentIndex ? 'bg-white w-2' : 'bg-white/60'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Court Card Component (Airbnb style)
function CourtCard({ court, onFavoriteToggle }: { court: Court; onFavoriteToggle: (id: string) => void }) {
  const navigate = useNavigate();

  return (
    <div className="group">
      {/* Image with favorite button */}
      <div className="relative">
        <ImageCarousel 
          images={court.images} 
          onImageClick={() => navigate(`/courts/${court.id}`)}
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFavoriteToggle(court.id);
          }}
          className="absolute top-3 right-3 z-10"
        >
          <Heart 
            className={`h-6 w-6 drop-shadow-md transition-colors ${
              court.isFavorite 
                ? 'fill-red-500 text-red-500' 
                : 'text-white hover:text-white/80 fill-black/30 hover:fill-black/50'
            }`} 
          />
        </button>
      </div>

      {/* Content */}
      <div 
        className="mt-3 cursor-pointer" 
        onClick={() => navigate(`/courts/${court.id}`)}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-[15px] text-foreground line-clamp-1">
            {court.city}
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            <Star className="h-3.5 w-3.5 fill-current" />
            <span className="text-sm">{court.rating}</span>
          </div>
        </div>
        <p className="text-muted-foreground text-sm line-clamp-1">{court.name}</p>
        <p className="text-muted-foreground text-sm">{court.isIndoor ? 'Indoor' : 'Outdoor'} · Up to {court.capacity} players</p>
        <p className="mt-1">
          <span className="font-semibold">${court.hourlyRate}</span>
          <span className="text-muted-foreground"> /hour</span>
        </p>
      </div>
    </div>
  );
}

export default function Home() {
  const { user, userRole, isLoading } = useAuth();
  const navigate = useNavigate();
  const [selectedSport, setSelectedSport] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [courts, setCourts] = useState(courtsData);
  const [showFilters, setShowFilters] = useState(false);
  const categoriesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth", { replace: true });
    }
    if (!isLoading && user && userRole === "court_manager") {
      navigate("/manager", { replace: true });
    }
  }, [user, userRole, isLoading, navigate]);

  // Filter courts
  const filteredCourts = courts.filter((court) => {
    const matchesSport = selectedSport === "all" || court.sport === selectedSport;
    const matchesSearch = searchQuery === "" || 
      court.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      court.venueName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      court.city.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSport && matchesSearch;
  });

  const handleFavoriteToggle = useCallback((courtId: string) => {
    setCourts(prev => prev.map(court => 
      court.id === courtId ? { ...court, isFavorite: !court.isFavorite } : court
    ));
  }, []);

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoriesRef.current) {
      const scrollAmount = 200;
      categoriesRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
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
    <div className="min-h-screen bg-background">
      {/* Fixed Header */}
      <header className="sticky top-0 z-50 bg-background border-b">
        {/* Top bar with logo and search */}
        <div className="px-4 lg:px-10 xl:px-20 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Logo - hidden on mobile */}
            <div className="hidden md:flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-display font-bold text-sm">N</span>
              </div>
              <span className="font-display font-bold text-xl text-primary">MatchUP</span>
            </div>

            {/* Search bar - Airbnb style */}
            <div className="flex-1 max-w-2xl">
              <div 
                className="flex items-center gap-2 border rounded-full px-4 py-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer bg-background"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Search className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <Input
                    placeholder="Search courts, locations..."
                    className="border-0 p-0 h-auto focus-visible:ring-0 text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <SlidersHorizontal className="h-4 w-4 text-primary-foreground" />
                </div>
              </div>
            </div>

            {/* User menu - hidden on mobile */}
            <div className="hidden md:flex items-center gap-4">
              <Button variant="ghost" size="sm" className="rounded-full">
                List your court
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                className="rounded-full"
                onClick={() => navigate("/profile")}
              >
                <User className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Categories bar */}
        <div className="relative px-4 lg:px-10 xl:px-20 pb-4">
          <div className="flex items-center gap-2">
            {/* Scroll left button */}
            <button 
              onClick={() => scrollCategories('left')}
              className="hidden md:flex shrink-0 w-8 h-8 rounded-full border bg-background items-center justify-center hover:shadow-md transition-shadow"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Categories */}
            <div 
              ref={categoriesRef}
              className="flex-1 flex gap-8 overflow-x-auto scrollbar-hide scroll-smooth"
            >
              {sportCategories.map((category) => (
                <button
                  key={category.value}
                  onClick={() => setSelectedSport(category.value)}
                  className={`flex flex-col items-center gap-2 pb-2 border-b-2 transition-all shrink-0 ${
                    selectedSport === category.value
                      ? 'border-foreground text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                  }`}
                >
                  <span className="text-2xl">{category.icon}</span>
                  <span className="text-xs font-medium whitespace-nowrap">{category.label}</span>
                </button>
              ))}
            </div>

            {/* Scroll right button */}
            <button 
              onClick={() => scrollCategories('right')}
              className="hidden md:flex shrink-0 w-8 h-8 rounded-full border bg-background items-center justify-center hover:shadow-md transition-shadow"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {/* Filters button */}
            <Button 
              variant="outline" 
              size="sm" 
              className="shrink-0 rounded-xl gap-2"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 lg:px-10 xl:px-20 py-6">
        {/* Results count */}
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            {filteredCourts.length} court{filteredCourts.length !== 1 ? 's' : ''} available
          </p>
        </div>

        {/* Courts Grid - Airbnb style */}
        {filteredCourts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {filteredCourts.map((court) => (
              <CourtCard 
                key={court.id} 
                court={court} 
                onFavoriteToggle={handleFavoriteToggle}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Search className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No courts found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search or filters
            </p>
            <Button 
              variant="outline"
              onClick={() => {
                setSelectedSport("all");
                setSearchQuery("");
              }}
            >
              Clear all filters
            </Button>
          </div>
        )}
      </main>

      {/* Bottom Navigation - Mobile only */}
          <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t safe-bottom md:hidden">
              <div className="flex items-center justify-around h-16">
                  <button
                      onClick={() => navigate("/games")}
                      className="flex flex-col items-center justify-center gap-1 w-16 h-full text-muted-foreground"
                  >
                      <Calendar className="h-5 w-5" />
                      <span className="text-[10px] font-medium">Games</span>
                  </button>
                  <button
                      onClick={() => navigate("/")}
                      className="flex flex-col items-center justify-center gap-1 w-16 h-full text-primary"
                  >
                      <Search className="h-5 w-5 stroke-[2.5]" />
                      <span className="text-[10px] font-medium">Explore</span>
                  </button>
                  <button
                      onClick={() => navigate("/groups")}
                      className="flex flex-col items-center justify-center gap-1 w-16 h-full text-muted-foreground"
                  >
                      <Users className="h-5 w-5" />
                      <span className="text-[10px] font-medium">Groups</span>
                  </button>
                  <button
                      onClick={() => navigate("/profile")}
                      className="flex flex-col items-center justify-center gap-1 w-16 h-full text-muted-foreground"
                  >
                      <User className="h-5 w-5" />
                      <span className="text-[10px] font-medium">Profile</span>
                  </button>
              </div>
          </nav>

      {/* Desktop Sidebar Navigation */}
      <nav className="hidden md:block fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-1 bg-background border rounded-full px-2 py-2 shadow-lg">
          <Button
            variant={location.pathname === "/" ? "default" : "ghost"}
            size="sm"
            className="rounded-full gap-2"
            onClick={() => navigate("/")}
          >
            <Search className="h-4 w-4" />
            Explore
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full gap-2"
            onClick={() => navigate("/groups")}
          >
            <Users className="h-4 w-4" />
            Groups
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full gap-2"
            onClick={() => navigate("/games")}
          >
            <Calendar className="h-4 w-4" />
            Games
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full gap-2"
            onClick={() => navigate("/profile")}
          >
            <User className="h-4 w-4" />
            Profile
          </Button>
        </div>
      </nav>
    </div>
  );
}
