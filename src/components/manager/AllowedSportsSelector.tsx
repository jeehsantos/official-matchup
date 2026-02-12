import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, X } from "lucide-react";
import { useSportCategories } from "@/hooks/useSportCategories";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface AllowedSportsSelectorProps {
  allowedSports: string[];
  onAllowedSportsChange: (sports: string[]) => void;
}

export function AllowedSportsSelector({
  allowedSports,
  onAllowedSportsChange,
}: AllowedSportsSelectorProps) {
  const [sportsOpen, setSportsOpen] = useState(false);
  const { data: sportCategories = [], isLoading: loadingSports } = useSportCategories();

  const toggleSport = (sportName: string) => {
    if (allowedSports.includes(sportName)) {
      onAllowedSportsChange(allowedSports.filter((s) => s !== sportName));
    } else {
      onAllowedSportsChange([...allowedSports, sportName]);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Allowed Sports</Label>
      <p className="text-xs text-muted-foreground">
        Select which sports can be played at this court
      </p>
      <Popover open={sportsOpen} onOpenChange={setSportsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            type="button"
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
  );
}
