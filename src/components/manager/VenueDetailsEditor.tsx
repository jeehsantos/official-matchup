import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Box, Plus, X, Users, Bath, Car, Wifi, Coffee,
  BriefcaseMedical, Droplets, Armchair, Lock,
} from "lucide-react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation("manager");
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

  const defaultLabels = FACILITY_OPTIONS.map((f) => f.label);
  const customAmenities = amenities.filter((a) => !defaultLabels.includes(a));

  return (
    <Card className="rounded-2xl border border-border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Box className="h-5 w-5 text-primary" />
          {t("facilities.title")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {t("facilities.subtitle")}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
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

        <div className="flex gap-2 max-w-md">
          <Input
            ref={inputRef}
            value={customFacility}
            onChange={(e) => setCustomFacility(e.target.value)}
            placeholder={t("facilities.addCustomPlaceholder")}
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
            {t("facilities.addBtn")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
