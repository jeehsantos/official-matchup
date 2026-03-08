import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin,
  Phone,
  Mail,
  Share2,
  Clock,
  Users,
  DollarSign,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { SportIcon } from "@/components/ui/sport-icon";
import "leaflet/dist/leaflet.css";

function VenueMap({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    let map: any;

    import("leaflet").then((L) => {
      map = L.map(mapRef.current!, { scrollWheelZoom: false }).setView([lat, lng], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);
      L.marker([lat, lng]).addTo(map).bindPopup(name);
    });

    return () => {
      if (map) map.remove();
    };
  }, [lat, lng, name]);

  return <div ref={mapRef} className="h-64 rounded-lg z-0" />;
}

export default function VenueLanding() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: venue, isLoading: venueLoading } = useQuery({
    queryKey: ["venue-landing", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .eq("slug", slug!)
        .eq("is_active", true)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const { data: courts, isLoading: courtsLoading } = useQuery({
    queryKey: ["venue-courts", venue?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courts")
        .select("*")
        .eq("venue_id", venue!.id)
        .eq("is_active", true)
        .is("parent_court_id", null)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!venue?.id,
  });

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: "Link copied to clipboard!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy link", variant: "destructive" });
    }
  };

  if (venueLoading) {
    return (
      <PublicLayout>
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-8 w-1/3" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        </div>
      </PublicLayout>
    );
  }

  if (!venue) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <h1 className="font-display text-3xl font-bold mb-2">Venue Not Found</h1>
          <p className="text-muted-foreground mb-6">
            This venue page doesn't exist or is no longer active.
          </p>
          <Button asChild>
            <Link to="/courts">Browse Courts</Link>
          </Button>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      {/* Hero */}
      <div className="relative">
        {venue.photo_url ? (
          <div className="h-64 md:h-80 w-full overflow-hidden">
            <img
              src={venue.photo_url}
              alt={venue.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
          </div>
        ) : (
          <div className="h-48 md:h-64 w-full bg-gradient-to-br from-primary/20 to-primary/5" />
        )}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 max-w-6xl mx-auto">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground drop-shadow-sm">
            {venue.name}
          </h1>
          <div className="flex items-center gap-2 mt-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>
              {venue.address}, {venue.city}
              {venue.suburb ? `, ${venue.suburb}` : ""}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            {venue.description && (
              <div>
                <h2 className="font-display text-xl font-semibold mb-3">About</h2>
                <p className="text-muted-foreground leading-relaxed">{venue.description}</p>
              </div>
            )}

            {/* Amenities */}
            {venue.amenities && venue.amenities.length > 0 && (
              <div>
                <h2 className="font-display text-xl font-semibold mb-3">Amenities</h2>
                <div className="flex flex-wrap gap-2">
                  {venue.amenities.map((a: string) => (
                    <Badge key={a} variant="secondary" className="capitalize">
                      {a}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Courts */}
            <div>
              <h2 className="font-display text-xl font-semibold mb-4">
                Courts {courts && `(${courts.length})`}
              </h2>
              {courtsLoading ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-48 rounded-lg" />
                  ))}
                </div>
              ) : courts && courts.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {courts.map((court) => (
                    <Card
                      key={court.id}
                      className="overflow-hidden hover:shadow-md transition-shadow"
                    >
                      {court.photo_url && (
                        <div className="h-36 overflow-hidden">
                          <img
                            src={court.photo_url}
                            alt={court.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <CardContent className="p-4 space-y-3">
                        <h3 className="font-semibold text-lg">{court.name}</h3>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3.5 w-3.5" />
                            ${court.hourly_rate}/hr
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            Up to {court.capacity}
                          </span>
                          {court.is_indoor && (
                            <Badge variant="outline" className="text-xs">
                              Indoor
                            </Badge>
                          )}
                        </div>
                        {court.allowed_sports && court.allowed_sports.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {court.allowed_sports.map((sport: string) => (
                              <Badge key={sport} variant="secondary" className="text-xs capitalize">
                                {sport}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <Button asChild size="sm" className="w-full mt-2">
                          <Link to={`/courts/${court.id}`}>
                            Book Now <ExternalLink className="h-3.5 w-3.5 ml-1" />
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No courts available at this venue.</p>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Share */}
            <Button variant="outline" className="w-full" onClick={handleShare}>
              {copied ? (
                <Check className="h-4 w-4 mr-2" />
              ) : (
                <Share2 className="h-4 w-4 mr-2" />
              )}
              {copied ? "Copied!" : "Share this venue"}
            </Button>

            {/* Contact */}
            <Card>
              <CardContent className="p-5 space-y-4">
                <h3 className="font-semibold">Contact</h3>
                {venue.address && (
                  <div className="flex items-start gap-3 text-sm">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <span>
                      {venue.address}, {venue.city}
                      {venue.country ? `, ${venue.country}` : ""}
                    </span>
                  </div>
                )}
                {venue.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${venue.phone}`} className="hover:underline">
                      {venue.phone}
                    </a>
                  </div>
                )}
                {venue.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${venue.email}`} className="hover:underline">
                      {venue.email}
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Map */}
            {venue.latitude && venue.longitude && (
              <Card>
                <CardContent className="p-0 overflow-hidden rounded-lg">
                  <VenueMap
                    lat={Number(venue.latitude)}
                    lng={Number(venue.longitude)}
                    name={venue.name}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
