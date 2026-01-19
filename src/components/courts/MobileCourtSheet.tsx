import { useState } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { CourtCard } from "./CourtCard";
import type { Database } from "@/integrations/supabase/types";

type Court = Database["public"]["Tables"]["courts"]["Row"];
type Venue = Database["public"]["Tables"]["venues"]["Row"];

interface CourtWithVenue extends Court {
  venues: Venue | null;
}

interface MobileCourtSheetProps {
  courts: CourtWithVenue[];
  loading: boolean;
  highlightedCourtId: string | null;
  onHighlight: (id: string | null) => void;
}

export function MobileCourtSheet({
  courts,
  loading,
  highlightedCourtId,
  onHighlight,
}: MobileCourtSheetProps) {
  const [snap, setSnap] = useState<number | string | null>(0.15);

  // Calculate safe snap points - minimum visible, half, and max (below search header ~80px from top)
  // We use fixed pixel values for smaller screens to ensure visibility
  return (
    <DrawerPrimitive.Root 
      open={true} 
      modal={false}
      dismissible={false}
      snapPoints={["120px", 0.5, 0.85]}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay className="fixed inset-0 bg-transparent pointer-events-none" style={{ zIndex: 9998 }} />
        <DrawerPrimitive.Content 
          className="fixed left-0 right-0 flex flex-col rounded-t-[20px] bg-background border-t border-border shadow-2xl focus:outline-none"
          style={{ 
            zIndex: 40,
            bottom: '64px',
            // Max height stops below the search header (leaves ~80px for search + margin)
            height: 'calc(100dvh - 64px - 80px)',
            maxHeight: 'calc(100dvh - 64px - 80px)',
          }}
        >
          {/* Drag handle area - larger touch target */}
          <div 
            className="flex flex-col items-center pt-3 pb-2 cursor-grab active:cursor-grabbing shrink-0"
            style={{ touchAction: 'none' }}
          >
            <div className="h-1.5 w-12 rounded-full bg-muted-foreground/40 mb-2" />
            <p className="text-sm font-semibold text-foreground">
              {courts.length >= 100 ? `Over ${Math.floor(courts.length / 100) * 100}` : courts.length} court{courts.length !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-muted-foreground">Drag up to explore</p>
          </div>

          {/* Scrollable cards list */}
          <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
            <div className="p-4 space-y-4 pb-6">
              {loading ? (
                // Loading skeleton
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-[4/3] bg-muted rounded-xl mb-3" />
                    <div className="h-5 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </div>
                ))
              ) : courts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No courts found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {courts.map((court) => (
                    <CourtCard
                      key={court.id}
                      court={court}
                      onHover={onHighlight}
                      isHighlighted={court.id === highlightedCourtId}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}
