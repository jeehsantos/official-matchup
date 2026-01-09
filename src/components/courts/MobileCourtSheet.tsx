import { useState } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { CourtCardAirbnb } from "./CourtCardAirbnb";
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
  const [snap, setSnap] = useState<number | string | null>(0.4);

  return (
    <DrawerPrimitive.Root 
      open={true} 
      modal={false}
      dismissible={false}
      snapPoints={[0.15, 0.4, 0.93]}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay className="fixed inset-0 bg-transparent pointer-events-none" style={{ zIndex: 9998 }} />
        <DrawerPrimitive.Content 
          className="fixed left-0 right-0 flex flex-col rounded-t-[20px] bg-background border-t border-border shadow-2xl focus:outline-none"
          style={{ 
            zIndex: 9999,
            bottom: '64px',
            height: 'calc(100dvh - 56px - 64px)',
            maxHeight: 'calc(100dvh - 56px - 64px)',
            minHeight: '140px',
          }}
        >
          {/* Drag handle area - larger touch target */}
          <div 
            className="flex flex-col items-center pt-4 pb-3 cursor-grab active:cursor-grabbing"
            style={{ touchAction: 'none' }}
          >
            <div className="h-1.5 w-10 rounded-full bg-muted-foreground/50 mb-3" />
            <p className="text-base font-semibold text-foreground">
              {courts.length >= 100 ? `Over ${Math.floor(courts.length / 100) * 100}` : courts.length} court{courts.length !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Drag up to explore</p>
          </div>

          {/* Scrollable cards list */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="p-4 space-y-4 pb-20">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {courts.map((court) => (
                    <CourtCardAirbnb
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
