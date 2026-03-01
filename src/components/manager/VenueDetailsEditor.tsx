import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Box, Plus, X, Users, Bath, Car, Wifi, Coffee,
  BriefcaseMedical, Droplets, Armchair, Lock,
} from "lucide-react";

const FACILITY_OPTIONS: { label: string; icon: React.ElementType }[] = [
  { label: "Changing Room", icon: Users },
  { label: "Lockers", icon: Lock },
  { label: "Restrooms", icon: Bath },
  { label: "First Aid Kit", icon: BriefcaseMedical },
  { label: "Parking Lot", icon: Car },
  { label: "Wi-Fi", icon: Wifi },
  { label: "Cafeteria", icon: Coffee },
  { label: "Shower", icon: Droplets },
  { label: "Water Fountain", icon: Droplets },
  { label: "Seating Area", icon: Armchair },
];

interface VenueDetailsEditorProps {
  amenities: string[];
  onAmenitiesChange: (amenities: string[]) => void;
}

export function VenueDetailsEditor({
  amenities,
  onAmenitiesChange,
}: VenueDetailsEditorProps) {
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

  // Merge default options with any custom amenities not in defaults
  const defaultLabels = FACILITY_OPTIONS.map((f) => f.label);
  const customAmenities = amenities.filter((a) => !defaultLabels.includes(a));

  return (
    <Card className="rounded-2xl border border-border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Box className="h-5 w-5 text-primary" />
          Venue Facilities
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Select what facilities your venue offers, or add custom ones.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* Chip-style facility toggles */}
        <div className="flex flex-wrap gap-2.5">
          {FACILITY_OPTIONS.map(({ label, icon: Icon }) => {
            const selected = amenities.includes(label);
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleFacility(label)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all text-sm font-medium ${
                  selected
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-card border-border text-muted-foreground hover:border-muted-foreground/50 hover:bg-muted/50"
                }`}
              >
                <Icon size={18} className={selected ? "text-primary" : "text-muted-foreground"} />
                {label}
              </button>
            );
          })}

          {/* Custom amenities as chips */}
          {customAmenities.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => toggleFacility(label)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all text-sm font-medium bg-primary/10 border-primary text-primary"
            >
              {label}
              <X size={14} />
            </button>
          ))}
        </div>

        {/* Add custom facility */}
        <div className="flex gap-2 max-w-md">
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
            onClick={addCustomFacility}
            disabled={!customFacility.trim()}
            className="text-sm"
          >
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
