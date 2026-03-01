import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import L from "leaflet";
import { getCityCoordinates, nzCenter } from "@/data/nzLocations";
import type { Database } from "@/integrations/supabase/types";
import { Link } from "react-router-dom";
import { X } from "lucide-react";

type Court = Database["public"]["Tables"]["courts"]["Row"];
type Venue = Database["public"]["Tables"]["venues"]["Row"];

interface CourtWithVenue extends Court {
  venues: Venue | null;
}

interface CourtsMapProps {
  courts: CourtWithVenue[];
  highlightedCourtId: string | null;
  onMarkerHover?: (courtId: string | null) => void;
  linkSearch?: string;
}

const createPriceIcon = (price: number, isHighlighted: boolean) => {
  const label = `$${price}`;
  const estimatedWidth = label.length * 8 + 16;
  return L.divIcon({
    className: "custom-price-marker",
    html: `<div class="price-marker ${isHighlighted ? "highlighted" : ""}">${label}</div>`,
    iconSize: [estimatedWidth, 28],
    iconAnchor: [estimatedWidth / 2, 14],
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

interface PopupData {
  courtId: string;
  courtName: string;
  venueName: string;
  cityName: string;
  price: number;
  image: string;
  href: string;
  pixelPos: { x: number; y: number };
}

export function CourtsMap({ courts, highlightedCourtId, onMarkerHover, linkSearch = "" }: CourtsMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const hasInitializedBoundsRef = useRef(false);
  const geocodeInFlightRef = useRef<Set<string>>(new Set());
  const geocodeControllersRef = useRef<Map<string, AbortController>>(new Map());
  const [geocodedPositions, setGeocodedPositions] = useState<Record<string, { lat: number; lng: number }>>({});
  const [popup, setPopup] = useState<PopupData | null>(null);

  const closePopup = useCallback(() => {
    setPopup(null);
    onMarkerHover?.(null);
  }, [onMarkerHover]);

  // Geocoding effect
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

  const courtsWithPosition = useMemo(() => {
    return courts.map((court) => {
      if (court.venues?.latitude != null && court.venues?.longitude != null) {
        return { ...court, position: { lat: court.venues.latitude, lng: court.venues.longitude } };
      } else if (geocodedPositions[court.venue_id]) {
        const position = geocodedPositions[court.venue_id];
        return { ...court, position: { lat: position.lat, lng: position.lng } };
      } else if (court.venues?.city) {
        const cityCoords = getCityCoordinates(court.venues.city);
        const { latOffset, lngOffset } = getVenueOffset(court.venue_id);
        return { ...court, position: { lat: cityCoords.lat + latOffset, lng: cityCoords.lng + lngOffset } };
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
    L.control.zoom({ position: "topright" }).addTo(mapRef.current);

    // Close popup when clicking empty map area
    mapRef.current.on("click", () => {
      setPopup(null);
      onMarkerHover?.(null);
    });

    // Update popup position on zoom/pan
    mapRef.current.on("moveend", () => {
      setPopup((prev) => {
        if (!prev || !mapRef.current) return prev;
        const court = courtsWithPosition.find((c) => c.id === prev.courtId);
        if (!court) return prev;
        const point = mapRef.current!.latLngToContainerPoint([court.position.lat, court.position.lng]);
        return { ...prev, pixelPos: { x: point.x, y: point.y } };
      });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      hasInitializedBoundsRef.current = false;
    };
  }, []);

  // Update markers
  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    courtsWithPosition.forEach((court) => {
      const marker = L.marker([court.position.lat, court.position.lng], {
        icon: createPriceIcon(court.hourly_rate, court.id === highlightedCourtId),
      });

      marker.addTo(mapRef.current!);

      // Attach click handler directly on the rendered DOM element
      const el = marker.getElement();
      if (el) {
        el.style.cursor = 'pointer';
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          if (!mapRef.current) return;
          const point = mapRef.current.latLngToContainerPoint([court.position.lat, court.position.lng]);
          const venueImage = court.photo_urls?.[0] || court.photo_url || court.venues?.photo_url || '/placeholder.svg';
          setPopup({
            courtId: court.id,
            courtName: court.name,
            venueName: court.venues?.name || '',
            cityName: court.venues?.city || '',
            price: court.hourly_rate,
            image: venueImage,
            href: `/courts/${court.id}${linkSearch || ''}`,
            pixelPos: { x: point.x, y: point.y },
          });
          onMarkerHover?.(court.id);
        });
      }

      marker.addTo(mapRef.current!);
      markersRef.current.set(court.id, marker);
    });

    if (!hasInitializedBoundsRef.current && courtsWithPosition.length > 0) {
      const courtsWithRealCoords = courtsWithPosition.filter(
        (c) => c.venues?.latitude != null && c.venues?.longitude != null
      );
      if (courtsWithRealCoords.length > 0) {
        const bounds = L.latLngBounds(courtsWithRealCoords.map((c) => [c.position.lat, c.position.lng]));
        mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      } else if (courtsWithPosition[0]?.venues?.city) {
        const cityCoords = getCityCoordinates(courtsWithPosition[0].venues.city);
        mapRef.current.setView([cityCoords.lat, cityCoords.lng], 11);
      }
      hasInitializedBoundsRef.current = true;
    }
  }, [courtsWithPosition, linkSearch]);

  // Update marker icons on highlight change
  useEffect(() => {
    markersRef.current.forEach((marker, courtId) => {
      const court = courtsWithPosition.find((c) => c.id === courtId);
      if (court) {
        marker.setIcon(createPriceIcon(court.hourly_rate, courtId === highlightedCourtId));
      }
    });
  }, [highlightedCourtId, courtsWithPosition]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {popup && (
        <div
          className="absolute z-[1000] pointer-events-auto"
          style={{
            left: popup.pixelPos.x,
            top: popup.pixelPos.y - 8,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden w-[220px]">
            <button
              onClick={closePopup}
              className="absolute top-1 right-1 z-10 bg-background/80 rounded-full p-0.5 hover:bg-background"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <Link to={popup.href} className="block text-inherit no-underline">
              <img
                src={popup.image}
                alt={popup.courtName}
                className="w-full h-[120px] object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
              />
              <div className="p-2.5">
                <p className="font-semibold text-sm text-foreground leading-tight mb-0.5">
                  {popup.venueName || popup.courtName}
                </p>
                {popup.cityName && (
                  <p className="text-xs text-muted-foreground mb-1.5">{popup.cityName}</p>
                )}
                <p className="text-sm font-bold text-primary">${popup.price} /hour</p>
              </div>
            </Link>
          </div>
          {/* Arrow pointing down */}
          <div className="flex justify-center -mt-px">
            <div className="w-3 h-3 bg-card border-r border-b border-border rotate-45 -translate-y-1.5" />
          </div>
        </div>
      )}
    </div>
  );
}
