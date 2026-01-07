import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SportIcon } from "@/components/ui/sport-icon";
import { 
  Search, 
  MapPin, 
  Filter, 
  DollarSign,
  Users,
  Building2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Court = Database["public"]["Tables"]["courts"]["Row"];
type Venue = Database["public"]["Tables"]["venues"]["Row"];

interface CourtWithVenue extends Court {
  venues: Venue | null;
}

const sportFilters = ["all", "futsal", "basketball", "tennis", "volleyball", "badminton", "hockey"] as const;

export default function Courts() {
  const [courts, setCourts] = useState<CourtWithVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSport, setSelectedSport] = useState<string>("all");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [cities, setCities] = useState<string[]>([]);

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
      
      // Extract unique cities
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

  return (
    <MobileLayout>
      <div className="p-4 space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display text-2xl font-bold mb-2">Browse Courts</h1>
          <p className="text-muted-foreground">Find and book courts near you</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search courts, venues, cities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Sport Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
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
                  {sport}
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* City Filter */}
        {cities.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
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

        {/* Results */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-xl p-4 border border-border animate-pulse">
                <div className="h-40 bg-muted rounded-lg mb-4" />
                <div className="h-5 bg-muted rounded w-3/4 mb-2" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredCourts.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No Courts Found</h3>
            <p className="text-muted-foreground">
              {courts.length === 0 
                ? "No courts have been registered yet. Check back soon!"
                : "Try adjusting your filters or search query."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCourts.map((court) => (
              <Link 
                key={court.id} 
                to={`/courts/${court.id}`}
                className="block"
              >
                <div className="bg-card rounded-xl overflow-hidden border border-border hover:border-primary/50 transition-colors">
                  {/* Image */}
                  <div className="aspect-video bg-muted relative">
                    {court.photo_url ? (
                      <img 
                        src={court.photo_url} 
                        alt={court.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <SportIcon sport={court.sport_type} className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                    <Badge className="absolute top-3 left-3 capitalize">
                      <SportIcon sport={court.sport_type} className="h-3 w-3 mr-1" />
                      {court.sport_type}
                    </Badge>
                    {court.is_indoor && (
                      <Badge variant="secondary" className="absolute top-3 right-3">
                        Indoor
                      </Badge>
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-display font-semibold text-lg mb-1">{court.name}</h3>
                    {court.venues && (
                      <div className="flex items-center gap-1 text-muted-foreground text-sm mb-3">
                        <MapPin className="h-4 w-4" />
                        <span>{court.venues.name}, {court.venues.city}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          Up to {court.capacity}
                        </span>
                        <span className="flex items-center gap-1 text-primary font-semibold">
                          <DollarSign className="h-4 w-4" />
                          ${court.hourly_rate}/hr
                        </span>
                      </div>
                      <Button size="sm">View</Button>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
