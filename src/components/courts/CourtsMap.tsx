import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Link } from "react-router-dom";
import { getCityCoordinates, nzCenter } from "@/data/nzLocations";
import type { Database } from "@/integrations/supabase/types";

type Court = Database["public"]["Tables"]["courts"]["Row"];
type Venue = Database["public"]["Tables"]["venues"]["Row"];

interface CourtWithVenue extends Court {
  venues: Venue | null;
}

interface CourtsMapProps {
  courts: CourtWithVenue[];
  highlightedCourtId: string | null;
  onMarkerHover?: (courtId: string | null) => void;
}

// Custom price marker icon
const createPriceIcon = (price: number, isHighlighted: boolean) => {
  return L.divIcon({
    className: "custom-price-marker",
    html: `
      <div class="price-marker ${isHighlighted ? "highlighted" : ""}">
        $${price}
      </div>
    `,
    iconSize: [60, 28],
    iconAnchor: [30, 14],
  });
};

// Component to fit bounds when courts change
function MapBoundsHandler({ courts }: { courts: CourtWithVenue[] }) {
  const map = useMap();

  useEffect(() => {
    if (courts.length === 0) {
      map.setView([nzCenter.lat, nzCenter.lng], 5);
      return;
    }

    const courtsWithCoords = courts.filter(
      (c) => c.venues?.latitude && c.venues?.longitude
    );

    if (courtsWithCoords.length > 0) {
      const bounds = L.latLngBounds(
        courtsWithCoords.map((c) => [c.venues!.latitude!, c.venues!.longitude!])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    } else if (courts[0]?.venues?.city) {
      const cityCoords = getCityCoordinates(courts[0].venues.city);
      map.setView([cityCoords.lat, cityCoords.lng], 11);
    }
  }, [courts, map]);

  return null;
}

export function CourtsMap({ courts, highlightedCourtId, onMarkerHover }: CourtsMapProps) {
  // Get courts with coordinates (real or city-based fallback)
  const courtsWithPosition = useMemo(() => {
    return courts.map((court) => {
      if (court.venues?.latitude && court.venues?.longitude) {
        return {
          ...court,
          position: { lat: court.venues.latitude, lng: court.venues.longitude },
        };
      } else if (court.venues?.city) {
        const cityCoords = getCityCoordinates(court.venues.city);
        // Add slight random offset for courts in same city
        return {
          ...court,
          position: {
            lat: cityCoords.lat + (Math.random() - 0.5) * 0.02,
            lng: cityCoords.lng + (Math.random() - 0.5) * 0.02,
          },
        };
      }
      return null;
    }).filter(Boolean) as (CourtWithVenue & { position: { lat: number; lng: number } })[];
  }, [courts]);

  return (
    <MapContainer
      center={[nzCenter.lat, nzCenter.lng]}
      zoom={5}
      className="w-full h-full"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapBoundsHandler courts={courts} />
      
      {courtsWithPosition.map((court) => (
        <Marker
          key={court.id}
          position={[court.position.lat, court.position.lng]}
          icon={createPriceIcon(court.hourly_rate, court.id === highlightedCourtId)}
          eventHandlers={{
            mouseover: () => onMarkerHover?.(court.id),
            mouseout: () => onMarkerHover?.(null),
          }}
        >
          <Popup>
            <Link to={`/courts/${court.id}`} className="block p-1">
              <div className="font-semibold">{court.name}</div>
              {court.venues && (
                <div className="text-sm text-muted-foreground">
                  {court.venues.name}
                </div>
              )}
              <div className="text-sm font-medium text-primary mt-1">
                ${court.hourly_rate}/hr
              </div>
            </Link>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
