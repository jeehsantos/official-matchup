import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ManagerLayout } from "@/components/layout/ManagerLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Building2, 
  Plus,
  MapPin,
  Phone,
  Mail,
  Edit,
  ChevronRight,
  Loader2,
  Search
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Database } from "@/integrations/supabase/types";

type Venue = Database["public"]["Tables"]["venues"]["Row"];

export default function ManagerVenues() {
  const { user } = useAuth();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [cityFilter, setCityFilter] = useState<string>("all");

  useEffect(() => {
    if (user) {
      fetchVenues();
    }
  }, [user]);

  const fetchVenues = async () => {
    try {
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .eq("owner_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVenues(data || []);
    } catch (error) {
      console.error("Error fetching venues:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique cities from venues
  const cities = useMemo(() => {
    const uniqueCities = [...new Set(venues.map(v => v.city).filter(Boolean))] as string[];
    return uniqueCities.sort();
  }, [venues]);

  // Filter venues based on search and filters
  const filteredVenues = useMemo(() => {
    return venues.filter(venue => {
      const matchesSearch = 
        venue.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        venue.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        venue.address?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = 
        statusFilter === "all" ||
        (statusFilter === "active" && venue.is_active) ||
        (statusFilter === "inactive" && !venue.is_active);
      
      const matchesCity = 
        cityFilter === "all" || venue.city === cityFilter;

      return matchesSearch && matchesStatus && matchesCity;
    });
  }, [venues, searchQuery, statusFilter, cityFilter]);

  return (
    <ManagerLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold">Venues</h1>
              <p className="text-muted-foreground">
                {filteredVenues.length} venue{filteredVenues.length !== 1 ? "s" : ""} found
              </p>
            </div>
            <Link to="/manager/venues/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Venue
              </Button>
            </Link>
          </div>

          {/* Search and Filters */}
          <div className="space-y-3">
            {/* Search Bar */}
            <div className="relative">
              <div className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-2.5 shadow-sm hover:shadow-md transition-shadow">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder="Search venues by name, city, or address..."
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

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap gap-2">
              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as "all" | "active" | "inactive")}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <span>{statusFilter === "all" ? "📋" : statusFilter === "active" ? "✅" : "⏸️"}</span>
                      <span className="text-sm">
                        {statusFilter === "all" ? "All Status" : statusFilter === "active" ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border shadow-lg">
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <span>📋</span>
                      <span>All Status</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="active">
                    <div className="flex items-center gap-2">
                      <span>✅</span>
                      <span>Active</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="inactive">
                    <div className="flex items-center gap-2">
                      <span>⏸️</span>
                      <span>Inactive</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* City Filter */}
              {cities.length > 0 && (
                <Select value={cityFilter} onValueChange={setCityFilter}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="text-sm">{cityFilter === "all" ? "All Cities" : cityFilter}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border shadow-lg">
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5" />
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
        </div>

        {/* Venues List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : venues.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">No venues yet</h3>
              <p className="text-muted-foreground mb-4">
                Add your first venue to start listing courts and receiving bookings.
              </p>
              <Link to="/manager/venues/new">
                <Button>Add Your First Venue</Button>
              </Link>
            </CardContent>
          </Card>
        ) : filteredVenues.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">No venues found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search or filters.
              </p>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setCityFilter("all");
                }}
              >
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredVenues.map((venue) => (
              <Card key={venue.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex">
                    {/* Image */}
                    <div className="w-32 h-32 bg-muted shrink-0">
                      {venue.photo_url ? (
                        <img 
                          src={venue.photo_url} 
                          alt={venue.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Building2 className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold">{venue.name}</h3>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {venue.city}
                          </div>
                        </div>
                        <Badge variant={venue.is_active ? "default" : "secondary"}>
                          {venue.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground line-clamp-1 mb-3">
                        {venue.address}
                      </p>
                      
                      <div className="flex gap-2">
                        <Link to={`/manager/venues/${venue.id}/edit`}>
                          <Button variant="outline" size="sm" className="gap-1">
                            <Edit className="h-3 w-3" />
                            Edit
                          </Button>
                        </Link>
                        <Link to={`/manager/venues/${venue.id}/courts`}>
                          <Button size="sm" className="gap-1">
                            Manage Courts
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}
