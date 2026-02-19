import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, Users } from "lucide-react";
import { useSportCategories } from "@/hooks/useSportCategories";
import { useUserProfile } from "@/hooks/useUserProfile";
import { cn } from "@/lib/utils";

interface QuickGameModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const gameModes = [
  { value: "1vs1", label: "1 vs 1", players: 2 },
  { value: "2vs2", label: "2 vs 2", players: 4 },
  { value: "3vs3", label: "3 vs 3", players: 6 },
  { value: "4vs4", label: "4 vs 4", players: 8 },
  { value: "5vs5", label: "5 vs 5", players: 10 },
];

export function QuickGameModal({ open, onOpenChange }: QuickGameModalProps) {
  const navigate = useNavigate();
  const [selectedSport, setSelectedSport] = useState<string>("");
  const [selectedMode, setSelectedMode] = useState<string>("");
  const [isRedirecting, setIsRedirecting] = useState(false);

  const { data: allSportCategories = [], isLoading: loadingSports } = useSportCategories();
  const { preferredSports } = useUserProfile();

  // Filter sport categories by user's preferred sports
  const filteredCategories = useMemo(() => {
    if (preferredSports.length === 0) return allSportCategories;
    const filtered = allSportCategories.filter(cat => preferredSports.includes(cat.name));
    return filtered.length > 0 ? filtered : allSportCategories;
  }, [allSportCategories, preferredSports]);

  const sports = useMemo(() => {
    return filteredCategories.map(cat => ({
      value: cat.id,
      label: cat.display_name,
      name: cat.name,
      emoji: cat.icon || "🎯",
    }));
  }, [filteredCategories]);

  const handleFindCourts = () => {
    if (!selectedSport || !selectedMode) return;
    
    setIsRedirecting(true);
    
    const selectedSportData = sports.find(s => s.value === selectedSport);
    const selectedModeData = gameModes.find(m => m.value === selectedMode);
    
    // Store quick game config in sessionStorage for persistence
    sessionStorage.setItem('quickGameConfig', JSON.stringify({
      sportCategoryId: selectedSport,
      sportName: selectedSportData?.name,
      sportLabel: selectedSportData?.label,
      gameMode: selectedMode,
      totalPlayers: selectedModeData?.players,
    }));
    
    // Navigate to courts page with sport filter
    setTimeout(() => {
      onOpenChange(false);
      navigate(`/courts?sport=${selectedSportData?.name}&quickGame=true`);
    }, 300);
  };

  const handleClose = () => {
    setSelectedSport("");
    setSelectedMode("");
    setIsRedirecting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-display">
            <div className="p-2 rounded-lg bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            Quick Game
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Sport Category Dropdown */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Sport Category
            </label>
            {loadingSports ? (
              <div className="flex items-center gap-2 h-11 px-3 border rounded-lg text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading sports...</span>
              </div>
            ) : (
              <Select value={selectedSport} onValueChange={setSelectedSport}>
                <SelectTrigger className="h-12 bg-background border-border">
                  <SelectValue placeholder="Select a sport">
                    {selectedSport && (
                      <div className="flex items-center gap-2">
                        <span>{sports.find(s => s.value === selectedSport)?.emoji}</span>
                        <span>{sports.find(s => s.value === selectedSport)?.label}</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border shadow-lg z-50">
                  {sports.map((sport) => (
                    <SelectItem key={sport.value} value={sport.value}>
                      <div className="flex items-center gap-2">
                        <span>{sport.emoji}</span>
                        <span>{sport.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Game Mode Dropdown */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Game Mode
            </label>
            <Select value={selectedMode} onValueChange={setSelectedMode}>
              <SelectTrigger className="h-12 bg-background border-border">
                <SelectValue placeholder="Select game mode" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                {gameModes.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value}>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{mode.label}</span>
                      <span className="text-xs text-muted-foreground">
                        ({mode.players} players)
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Mode Preview */}
          {selectedMode && (
            <div className="p-4 rounded-lg bg-muted/50 border border-border animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total players needed:</span>
                <span className="font-bold text-primary">
                  {gameModes.find(m => m.value === selectedMode)?.players} players
                </span>
              </div>
            </div>
          )}

          {/* Find Courts Button */}
          <Button
            className={cn(
              "w-full h-12 font-semibold text-base",
              "bg-primary hover:bg-primary/90 text-primary-foreground",
              "transition-all duration-200 hover:scale-[1.02]"
            )}
            disabled={!selectedSport || !selectedMode || isRedirecting}
            onClick={handleFindCourts}
          >
            {isRedirecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Finding courts...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Find Available Courts
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
