import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronUp, Building2, Plus, X } from "lucide-react";
import { useSportCategories } from "@/hooks/useSportCategories";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const DEFAULT_FACILITIES = [
  "Changing Room",
  "Shower",
  "Lockers",
  "Parking Lot",
  "Restrooms",
  "Water Fountain",
  "First Aid Kit",
  "Wi-Fi",
  "Seating Area",
  "Cafeteria",
];

interface VenueDetailsEditorProps {
  allowedSports: string[];
  amenities: string[];
  onAllowedSportsChange: (sports: string[]) => void;
  onAmenitiesChange: (amenities: string[]) => void;
}

export function VenueDetailsEditor({
  allowedSports,
  amenities,
  onAllowedSportsChange,
  onAmenitiesChange,
}: VenueDetailsEditorProps) {
  const [expanded, setExpanded] = useState(true);
  const [customFacility, setCustomFacility] = useState("");
  const [sportsOpen, setSportsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: sportCategories = [], isLoading: loadingSports } = useSportCategories();

  const toggleSport = (sportName: string) => {
    if (allowedSports.includes(sportName)) {
      onAllowedSportsChange(allowedSports.filter((s) => s !== sportName));
    } else {
      onAllowedSportsChange([...allowedSports, sportName]);
    }
  };

  const toggleFacility = (facility: string) => {
    if (amenities.includes(facility)) {
      onAmenitiesChange(amenities.filter((a) => a !== facility));
    } else {
      onAmenitiesChange([...amenities, facility]);
    }
  };

  const addCustomFacility = () => {
    const trimmed = customFacility.trim();
    if (trimmed && !amenities.includes(trimmed)) {
      onAmenitiesChange([...amenities, trimmed]);
      setCustomFacility("");
      inputRef.current?.focus();
    }
  };

  const removeFacility = (facility: string) => {
    onAmenitiesChange(amenities.filter((a) => a !== facility));
  };

  // Combine default + any custom ones already selected
  const allFacilityOptions = [
    ...DEFAULT_FACILITIES,
    ...amenities.filter((a) => !DEFAULT_FACILITIES.includes(a)),
  ];

  return (
    <Card className="bg-card border-border shadow-sm">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-primary" />
                Venue Details
              </CardTitle>
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-5 pt-0">
            {/* Allowed Sports */}
            <div className="space-y-2">
              <Label>Allowed Sports</Label>
              <p className="text-xs text-muted-foreground">
                Select which sports can be played at this venue
              </p>
              <Popover open={sportsOpen} onOpenChange={setSportsOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between text-left font-normal h-auto min-h-10"
                  >
                    <span className="truncate">
                      {allowedSports.length === 0
                        ? "Select sports..."
                        : `${allowedSports.length} sport${allowedSports.length > 1 ? "s" : ""} selected`}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start">
                  {loadingSports ? (
                    <p className="text-sm text-muted-foreground p-2">Loading...</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {sportCategories.map((sport) => (
                        <label
                          key={sport.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer"
                        >
                          <Checkbox
                            checked={allowedSports.includes(sport.name)}
                            onCheckedChange={() => toggleSport(sport.name)}
                          />
                          <span className="text-sm">
                            {sport.icon && <span className="mr-1">{sport.icon}</span>}
                            {sport.display_name}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              {/* Selected sports badges */}
              {allowedSports.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {allowedSports.map((sport) => {
                    const cat = sportCategories.find((c) => c.name === sport);
                    return (
                      <Badge
                        key={sport}
                        variant="secondary"
                        className="gap-1 cursor-pointer hover:bg-destructive/20"
                        onClick={() => toggleSport(sport)}
                      >
                        {cat?.icon && <span>{cat.icon}</span>}
                        {cat?.display_name || sport}
                        <X className="h-3 w-3" />
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Facilities / Amenities */}
            <div className="space-y-2">
              <Label>Facilities</Label>
              <p className="text-xs text-muted-foreground">
                Select what facilities your venue offers, or add custom ones
              </p>
              <div className="grid grid-cols-2 gap-2">
                {allFacilityOptions.map((facility) => (
                  <label
                    key={facility}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={amenities.includes(facility)}
                      onCheckedChange={() => toggleFacility(facility)}
                    />
                    {facility}
                  </label>
                ))}
              </div>

              {/* Custom facility input */}
              <div className="flex gap-2 mt-2">
                <Input
                  ref={inputRef}
                  value={customFacility}
                  onChange={(e) => setCustomFacility(e.target.value)}
                  placeholder="Add custom facility..."
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomFacility();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={addCustomFacility}
                  disabled={!customFacility.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Selected amenities badges */}
              {amenities.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {amenities.map((a) => (
                    <Badge
                      key={a}
                      variant="outline"
                      className="gap-1 cursor-pointer hover:bg-destructive/20"
                      onClick={() => removeFacility(a)}
                    >
                      {a}
                      <X className="h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
