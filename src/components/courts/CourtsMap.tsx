import { useEffect, useRef, useMemo, useState } from "react";
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
  /** Preserve the current search params when linking to /courts/:id (e.g. ?quickGame=true) */
  linkSearch?: string;
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

const normalizeHash = (value: number) => ((value % 1000) + 1000) % 1000 / 1000;

const getVenueOffset = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const latOffset = (normalizeHash(hash) - 0.5) * 0.02;
  const lngOffset = (normalizeHash(hash >> 8) - 0.5) * 0.02;
  return { latOffset, lngOffset };
};

export function CourtsMap({ courts, highlightedCourtId, onMarkerHover, linkSearch = "" }: CourtsMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const hasInitializedBoundsRef = useRef(false);
  const geocodeInFlightRef = useRef<Set<string>>(new Set());
  const geocodeControllersRef = useRef<Map<string, AbortController>>(new Map());
  const [geocodedPositions, setGeocodedPositions] = useState<Record<string, { lat: number; lng: number }>>({});

  useEffect(() => {
    const venuesToGeocode = new Map<string, string>();

    courts.forEach((court) => {
      const venue = court.venues;
      if (!venue) return;
      if (venue.latitude != null && venue.longitude != null) return;
      if (geocodedPositions[court.venue_id]) return;

      const addressParts = [venue.address, venue.city, venue.country].filter(Boolean);
      if (addressParts.length === 0) return;

      if (!geocodeInFlightRef.current.has(court.venue_id)) {
        venuesToGeocode.set(court.venue_id, addressParts.join(", "));
      }
    });

    if (venuesToGeocode.size === 0) return;

    const fetchGeocodes = async () => {
      const nextPositions: Record<string, { lat: number; lng: number }> = {};

      for (const [venueId, query] of venuesToGeocode.entries()) {
        geocodeInFlightRef.current.add(venueId);
        const controller = new AbortController();
        geocodeControllersRef.current.set(venueId, controller);
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`,
            { headers: { "Accept-Language": "en" }, signal: controller.signal }
          );
          if (!response.ok) continue;
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            const [result] = data;
            const lat = Number(result.lat);
            const lng = Number(result.lon);
            if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
              nextPositions[venueId] = { lat, lng };
            }
          }
        } catch (error) {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            console.warn("Failed to geocode venue address", error);
          }
        } finally {
          geocodeInFlightRef.current.delete(venueId);
          geocodeControllersRef.current.delete(venueId);
        }
      }

      if (Object.keys(nextPositions).length > 0) {
        setGeocodedPositions((prev) => ({ ...prev, ...nextPositions }));
      }
    };

    fetchGeocodes();

    return () => {
      geocodeControllersRef.current.forEach((controller) => controller.abort());
      geocodeControllersRef.current.clear();
      geocodeInFlightRef.current.clear();
    };
  }, [courts, geocodedPositions]);

  // Get courts with coordinates (real or city-based fallback)
  const courtsWithPosition = useMemo(() => {
    return courts.map((court) => {
      if (court.venues?.latitude != null && court.venues?.longitude != null) {
        return {
          ...court,
          position: { lat: court.venues.latitude, lng: court.venues.longitude },
        };
      } else if (geocodedPositions[court.venue_id]) {
        const position = geocodedPositions[court.venue_id];
        return {
          ...court,
          position: { lat: position.lat, lng: position.lng },
        };
      } else if (court.venues?.city) {
        const cityCoords = getCityCoordinates(court.venues.city);
        const { latOffset, lngOffset } = getVenueOffset(court.venue_id);
        // Add slight deterministic offset for courts in same city
        return {
          ...court,
          position: {
            lat: cityCoords.lat + latOffset,
            lng: cityCoords.lng + lngOffset,
          },
        };
      }
      return null;
    }).filter(Boolean) as (CourtWithVenue & { position: { lat: number; lng: number } })[];
  }, [courts, geocodedPositions]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current, {
      center: [nzCenter.lat, nzCenter.lng],
      zoom: 5,
      zoomControl: false,
      scrollWheelZoom: true,
      touchZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
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
      hasInitializedBoundsRef.current = false;
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

      // Build popup with image - escape quotes properly
      const venueImage = court.photo_urls?.[0] || court.photo_url || court.venues?.photo_url || '/placeholder.svg';
      const courtName = court.name.replace(/'/g, "\\'");
      const venueName = court.venues?.name?.replace(/'/g, "\\'") || '';
      const cityName = court.venues?.city?.replace(/'/g, "\\'") || '';
      const courtHref = `/courts/${court.id}${linkSearch || ''}`;
      
      const popupContent = `
        <div style="min-width: 200px;">
          <a href="${courtHref}" style="display: block; text-decoration: none; color: inherit;">
            <img 
              src="${venueImage}" 
              alt="${courtName}"
              style="width: 100%; height: 128px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;"
              onerror="this.src='/placeholder.svg'"
            />
            <div style="font-weight: 600; font-size: 16px; margin-bottom: 4px;">${courtName}</div>
            ${venueName ? `<div style="font-size: 14px; color: #666; margin-bottom: 2px;">${venueName}</div>` : ''}
            ${cityName ? `<div style="font-size: 12px; color: #999;">${cityName}</div>` : ''}
            <div style="font-size: 14px; font-weight: 700; color: hsl(174 72% 40%); margin-top: 8px;">$${court.hourly_rate} NZD/hour</div>
          </a>
        </div>
      `;
      
      marker.bindPopup(popupContent, {
        maxWidth: 250,
        minWidth: 200,
        className: 'court-popup',
        closeButton: true,
        autoClose: true,
        closeOnClick: true
      });

      // Open popup on click
      marker.on("click", () => {
        mapRef.current?.closePopup();
        marker.openPopup();
        onMarkerHover?.(court.id);
      });
      marker.on("popupclose", () => {
        if (onMarkerHover) {
          onMarkerHover(null);
        }
      });

      marker.addTo(mapRef.current!);
      markersRef.current.set(court.id, marker);
    });

    // Only fit bounds on initial load, not on every filter change
    if (!hasInitializedBoundsRef.current && courtsWithPosition.length > 0) {
      const courtsWithRealCoords = courtsWithPosition.filter(
        (c) => c.venues?.latitude != null && c.venues?.longitude != null
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
      hasInitializedBoundsRef.current = true;
    }
  }, [courtsWithPosition, linkSearch]);

  // Update marker icons when highlighted court changes (without recreating markers)
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
