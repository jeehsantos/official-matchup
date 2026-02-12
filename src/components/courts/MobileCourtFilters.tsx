import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MapPin, RotateCcw, Check, Loader2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { SurfaceType } from "@/hooks/useSurfaceTypes";

interface SportFilterOption {
  value: string;
  label: string;
  emoji: string;
}

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
  selectedSport: string;
  setSelectedSport: (value: string) => void;
  sportOptions: SportFilterOption[];
  loadingSports?: boolean;
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
  selectedSport,
  setSelectedSport,
  sportOptions,
  loadingSports = false,
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
    setSelectedSport("all");
  };

  const hasActiveFilters =
    selectedGroundType !== "all" ||
    selectedVenueType !== "all" ||
    selectedCity !== "all" ||
    selectedSport !== "all";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl flex flex-col">
        <SheetHeader className="pb-4 shrink-0">
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

        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="py-4 pb-24">
            <div className="rounded-2xl border border-border overflow-hidden">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="surface" className="border-b border-border">
                  <AccordionTrigger className="px-4 py-4 hover:no-underline">
                    <Label className="text-sm font-medium">Surface Type</Label>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    {surfaceTypes.length === 0 ? (
                      <div className="flex items-center gap-2 text-muted-foreground py-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading surface types...
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {groundTypeFilters.map((type) => {
                          const data = groundTypeData[type];
                          const isSelected = selectedGroundType === type;
                          return (
                            <Button
                              key={type}
                              variant={isSelected ? "default" : "outline"}
                              onClick={() => setSelectedGroundType(type)}
                              className="justify-start"
                            >
                              <span className="mr-2">{data?.emoji || "🎯"}</span>
                              <span>{data?.label || type}</span>
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="venue" className="border-b border-border">
                  <AccordionTrigger className="px-4 py-4 hover:no-underline">
                    <Label className="text-sm font-medium">Indoor / Outdoor</Label>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {venueTypeData.map((type) => {
                        const isSelected = selectedVenueType === type.value;
                        return (
                          <Button
                            key={type.value}
                            variant={isSelected ? "default" : "outline"}
                            onClick={() => setSelectedVenueType(type.value as "all" | "indoor" | "outdoor")}
                            className="justify-start"
                          >
                            <span className="mr-2">{type.emoji}</span>
                            <span>{type.label}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="sport" className="border-b border-border">
                  <AccordionTrigger className="px-4 py-4 hover:no-underline">
                    <Label className="text-sm font-medium">Sport</Label>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    {loadingSports ? (
                      <div className="flex items-center gap-2 text-muted-foreground py-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading sports...
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {sportOptions.map((sport) => (
                          <Button
                            key={sport.value}
                            variant={selectedSport === sport.value ? "default" : "outline"}
                            className="justify-start"
                            onClick={() => setSelectedSport(sport.value)}
                          >
                            <span className="mr-2">{sport.emoji}</span>
                            <span>{sport.label}</span>
                          </Button>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {cities.length > 0 && (
                  <AccordionItem value="city" className="border-b-0">
                    <AccordionTrigger className="px-4 py-4 hover:no-underline">
                      <Label className="text-sm font-medium">City</Label>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Button variant={selectedCity === "all" ? "default" : "outline"} className="justify-start" onClick={() => setSelectedCity("all")}>
                          <MapPin className="h-4 w-4 mr-2" />
                          All Cities
                        </Button>
                        {cities.map((city) => (
                          <Button key={city} variant={selectedCity === city ? "default" : "outline"} className="justify-start" onClick={() => setSelectedCity(city)}>
                            {city}
                          </Button>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </div>
          </div>
        </div>

        {/* Apply Filters Button - Fixed at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 pt-4 border-t border-border bg-background shrink-0" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
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
