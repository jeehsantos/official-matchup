import { useEffect, useRef, useMemo } from "react";
import L from "leaflet";
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
        $${price} NZD
      </div>
    `,
    iconSize: [80, 28],
    iconAnchor: [40, 14],
  });
};

export function CourtsMap({ courts, highlightedCourtId, onMarkerHover }: CourtsMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

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

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current, {
      center: [nzCenter.lat, nzCenter.lng],
      zoom: 5,
      zoomControl: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(mapRef.current);

    // Add zoom control to top-right
    L.control.zoom({ position: "topright" }).addTo(mapRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers when courts change
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    // Add new markers
    courtsWithPosition.forEach((court) => {
      const marker = L.marker([court.position.lat, court.position.lng], {
        icon: createPriceIcon(court.hourly_rate, court.id === highlightedCourtId),
      });

      marker.on("mouseover", () => onMarkerHover?.(court.id));
      marker.on("mouseout", () => onMarkerHover?.(null));

      const popupContent = `
        <a href="/courts/${court.id}" class="block p-1">
          <div class="font-semibold">${court.name}</div>
          ${court.venues ? `<div class="text-sm text-gray-500">${court.venues.name}</div>` : ""}
          <div class="text-sm font-medium mt-1">$${court.hourly_rate} NZD/hr</div>
        </a>
      `;
      marker.bindPopup(popupContent);

      marker.addTo(mapRef.current!);
      markersRef.current.set(court.id, marker);
    });

    // Fit bounds
    if (courtsWithPosition.length > 0) {
      const courtsWithRealCoords = courtsWithPosition.filter(
        (c) => c.venues?.latitude && c.venues?.longitude
      );

      if (courtsWithRealCoords.length > 0) {
        const bounds = L.latLngBounds(
          courtsWithRealCoords.map((c) => [c.position.lat, c.position.lng])
        );
        mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      } else if (courtsWithPosition[0]?.venues?.city) {
        const cityCoords = getCityCoordinates(courtsWithPosition[0].venues.city);
        mapRef.current.setView([cityCoords.lat, cityCoords.lng], 11);
      }
    }
  }, [courtsWithPosition, highlightedCourtId, onMarkerHover]);

  // Update marker icons when highlighted court changes
  useEffect(() => {
    markersRef.current.forEach((marker, courtId) => {
      const court = courtsWithPosition.find((c) => c.id === courtId);
      if (court) {
        marker.setIcon(createPriceIcon(court.hourly_rate, courtId === highlightedCourtId));
      }
    });
  }, [highlightedCourtId, courtsWithPosition]);

  return <div ref={containerRef} className="w-full h-full" />;
}
