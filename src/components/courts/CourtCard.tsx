import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SportIcon } from "@/components/ui/sport-icon";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";

type Court = Database["public"]["Tables"]["courts"]["Row"];
type Venue = Database["public"]["Tables"]["venues"]["Row"];

interface CourtWithVenue extends Court {
  venues: Venue | null;
}

interface CourtCardProps {
  court: CourtWithVenue;
  onHover?: (courtId: string | null) => void;
  isHighlighted?: boolean;
}

export function CourtCard({ court, onHover, isHighlighted }: CourtCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  
  // Get court image
  const getImages = (): string[] => {
    if (court.photo_url) return [court.photo_url];
    return [];
  };
  
  const images = getImages();

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFavorite(!isFavorite);
  };

  const handlePrevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  return (
    <Link
      to={`/courts/${court.id}`}
      className="block group"
      onMouseEnter={() => onHover?.(court.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <div className={`rounded-xl overflow-hidden transition-all duration-200 ${
        isHighlighted ? "ring-2 ring-primary shadow-lg" : ""
      }`}>
        {/* Image Container */}
        <div className="relative aspect-[4/3] bg-muted overflow-hidden rounded-xl">
          {images.length > 0 ? (
            <img
              src={images[imageIndex]}
              alt={court.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <SportIcon sport={court.sport_type} className="h-16 w-16 text-muted-foreground/50" />
            </div>
          )}

          {/* Sport Badge */}
          <Badge className="absolute top-3 left-3 capitalize bg-card/90 text-card-foreground backdrop-blur-sm">
            <SportIcon sport={court.sport_type} className="h-3 w-3 mr-1" />
            {court.sport_type}
          </Badge>

          {/* Indoor Badge */}
          {court.is_indoor && (
            <Badge variant="secondary" className="absolute top-3 left-24 bg-card/90 backdrop-blur-sm">
              Indoor
            </Badge>
          )}

          {/* Favorite Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 h-8 w-8 rounded-full bg-card/20 backdrop-blur-sm hover:bg-card/40"
            onClick={handleFavoriteClick}
          >
            <Heart
              className={`h-5 w-5 transition-colors ${
                isFavorite ? "fill-destructive text-destructive" : "text-white"
              }`}
            />
          </Button>

          {/* Image Navigation (only if multiple images) */}
          {images.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-card/80 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handlePrevImage}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-card/80 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleNextImage}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              {/* Image Dots */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                {images.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1.5 w-1.5 rounded-full transition-colors ${
                      idx === imageIndex ? "bg-white" : "bg-white/50"
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Content */}
        <div className="pt-3 pb-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">{court.name}</h3>
              {court.venues && (
                <p className="text-sm text-muted-foreground truncate">
                  {court.venues.name}, {court.venues.city}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>Up to {court.capacity}</span>
          </div>

          <p className="mt-1">
            <span className="font-semibold text-foreground">${court.hourly_rate}</span>
            <span className="text-muted-foreground"> /hour</span>
          </p>
        </div>
      </div>
    </Link>
  );
}
