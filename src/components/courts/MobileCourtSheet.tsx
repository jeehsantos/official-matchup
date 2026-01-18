import { useEffect, useState } from "react";
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

/* ============================
   Snap helpers (outside)
   ============================ */

const HEADER_OFFSET = 140;

const computeSnapPoints = (): number[] => {
  if (typeof window === "undefined") {
    return [0.12, 0.45, 0.85];
  }

  const vh = window.innerHeight;
  const isSmall = vh < 700;

  const rawMax = (vh - HEADER_OFFSET) / vh;
  const maxSnap = Math.min(Math.max(rawMax, 0.6), 0.85);

  return isSmall
    ? [0.25, 0.55, maxSnap]
    : [0.12, 0.45, maxSnap];
};

/* ============================
   Component
   ============================ */

export function MobileCourtSheet({
  courts,
  loading,
  highlightedCourtId,
  onHighlight,
}: MobileCourtSheetProps) {
  const [snapPoints, setSnapPoints] = useState<number[]>(computeSnapPoints);
  const [snap, setSnap] = useState<number>(snapPoints[0]);

  useEffect(() => {
    const points = computeSnapPoints();
    setSnapPoints(points);
    setSnap(points[0]);
  }, []);

  return (
    <DrawerPrimitive.Root
      open={true}
      modal={false}
      dismissible={false}
      snapPoints={snapPoints}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay
          className="fixed inset-0 bg-transparent pointer-events-none"
          style={{ zIndex: 9998 }}
        />

        <DrawerPrimitive.Content
          className="
            fixed left-0 right-0 bottom-0
            flex flex-col
            rounded-t-[20px]
            bg-background
            border-t border-border
            shadow-2xl
            focus:outline-none
            pb-[64px]
          "
          style={{ zIndex: 40 }}
        >
          {/* Drag handle */}
          <div
            className="flex flex-col items-center pt-4 pb-3 cursor-grab active:cursor-grabbing"
            style={{ touchAction: "none" }}
          >
            <div className="h-1.5 w-10 rounded-full bg-muted-foreground/50 mb-3" />
            <p className="text-base font-semibold text-foreground">
              {courts.length >= 100
                ? `Over ${Math.floor(courts.length / 100) * 100}`
                : courts.length}{" "}
              court{courts.length !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Drag up to explore
            </p>
          </div>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="p-4 space-y-4 pb-20">
              {loading ? (
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
