import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MapPin, RotateCcw, Check, Loader2 } from "lucide-react";
import type { SurfaceType } from "@/hooks/useSurfaceTypes";

interface MobileCourtFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedGroundType: string;
  setSelectedGroundType: (value: string) => void;
  selectedVenueType: "all" | "indoor" | "outdoor";
  setSelectedVenueType: (value: "all" | "indoor" | "outdoor") => void;
  selectedCity: string;
  setSelectedCity: (value: string) => void;
  cities: string[];
  activeFiltersCount: number;
  surfaceTypes?: SurfaceType[];
}

const venueTypeData = [
  { value: "all", emoji: "🏟️", label: "All Types" },
  { value: "indoor", emoji: "🏢", label: "Indoor" },
  { value: "outdoor", emoji: "🌳", label: "Outdoor" },
];

export function MobileCourtFilters({
  open,
  onOpenChange,
  selectedGroundType,
  setSelectedGroundType,
  selectedVenueType,
  setSelectedVenueType,
  selectedCity,
  setSelectedCity,
  cities,
  activeFiltersCount,
  surfaceTypes = [],
}: MobileCourtFiltersProps) {
  // Build ground type data from database
  const groundTypeData = useMemo(() => {
    const data: Record<string, { emoji: string; label: string }> = {
      all: { emoji: "🎯", label: "All Surfaces" },
    };
    surfaceTypes.forEach(surface => {
      data[surface.name] = {
        emoji: surface.name === "grass" ? "🌱" : 
               surface.name === "turf" ? "🟩" :
               surface.name === "sand" ? "🏖️" :
               surface.name === "hard" ? "🟫" :
               surface.name === "clay" ? "🟠" : "⚪",
        label: surface.display_name,
      };
    });
    return data;
  }, [surfaceTypes]);

  // Build ground type filters from database
  const groundTypeFilters = useMemo(() => {
    return ["all", ...surfaceTypes.map(s => s.name)];
  }, [surfaceTypes]);

  const handleClearFilters = () => {
    setSelectedGroundType("all");
    setSelectedVenueType("all");
    setSelectedCity("all");
  };

  const hasActiveFilters = selectedGroundType !== "all" || selectedVenueType !== "all" || selectedCity !== "all";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center justify-between">
            <span>Filter Courts</span>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={handleClearFilters}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-4">
          {/* Surface Type */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Surface Type</Label>
            {surfaceTypes.length === 0 ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading surface types...
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {groundTypeFilters.map((type) => {
                  const data = groundTypeData[type];
                  const isSelected = selectedGroundType === type;
                  return (
                    <Button
                      key={type}
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => setSelectedGroundType(type)}
                      className="flex-col h-auto py-3 gap-1"
                    >
                      <span className="text-lg">{data?.emoji || "🎯"}</span>
                      <span className="text-xs">{data?.label || type}</span>
                    </Button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Indoor / Outdoor */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Indoor / Outdoor</Label>
            <div className="grid grid-cols-3 gap-2">
              {venueTypeData.map((type) => {
                const isSelected = selectedVenueType === type.value;
                return (
                  <Button
                    key={type.value}
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => setSelectedVenueType(type.value as "all" | "indoor" | "outdoor")}
                    className="flex-col h-auto py-3 gap-1"
                  >
                    <span className="text-lg">{type.emoji}</span>
                    <span className="text-xs">{type.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* City */}
          {cities.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">City</Label>
              <Select value={selectedCity} onValueChange={setSelectedCity}>
                <SelectTrigger className="w-full h-12">
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
            </div>
          )}
        </div>

        {/* Apply Filters Button */}
        <div className="pt-4 border-t border-border">
          <Button onClick={() => onOpenChange(false)} className="w-full h-12 gap-2">
            <Check className="h-4 w-4" />
            Apply Filters
            {activeFiltersCount > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-primary-foreground/20 rounded-full text-xs">
                {activeFiltersCount}
              </span>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
