import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronUp, Building2, Plus, X } from "lucide-react";

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
  amenities: string[];
  onAmenitiesChange: (amenities: string[]) => void;
}

export function VenueDetailsEditor({
  amenities,
  onAmenitiesChange,
}: VenueDetailsEditorProps) {
  const [expanded, setExpanded] = useState(true);
  const [customFacility, setCustomFacility] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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
                Venue Facilities
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
