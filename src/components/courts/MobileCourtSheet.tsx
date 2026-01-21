import { useState, useRef, useMemo, useCallback } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { CourtCard } from "./CourtCard";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
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

const ITEMS_PER_PAGE = 14;

export function MobileCourtSheet({
  courts,
  loading,
  highlightedCourtId,
  onHighlight,
}: MobileCourtSheetProps) {
  const [snap, setSnap] = useState<number | string | null>(0.15);
  const [currentPage, setCurrentPage] = useState(1);
  const [showPagination, setShowPagination] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const totalPages = useMemo(() => Math.ceil(courts.length / ITEMS_PER_PAGE), [courts.length]);
  
  const paginatedCourts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return courts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [courts, currentPage]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight;
    const clientHeight = target.clientHeight;
    
    // Show pagination when scrolled more than 80% or at bottom
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
    setShowPagination(scrollPercentage > 0.8 || scrollTop > 100);
  }, []);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage]);

  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage, totalPages]);

  const hasPrevPage = currentPage > 1;
  const hasNextPage = currentPage < totalPages;
  const showPaginationControls = totalPages > 1;

  return (
    <DrawerPrimitive.Root 
      open={true} 
      modal={false}
      dismissible={false}
      snapPoints={["180px", 0.5, 0.85]}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay className="fixed inset-0 bg-transparent pointer-events-none" style={{ zIndex: 1 }} />
        <DrawerPrimitive.Content 
          className="fixed left-0 right-0 flex flex-col rounded-t-[20px] bg-background border-t border-border shadow-2xl focus:outline-none"
          style={{ 
            zIndex: 1,
            bottom: '0px',
            height: 'calc(100dvh - 40px)',
            maxHeight: 'calc(100dvh - 40px)',
          }}
        >
          {/* Handle area */}
          <div 
            className="flex flex-col items-center pt-3 pb-10 cursor-grab active:cursor-grabbing shrink-0" 
            style={{ touchAction: 'none' }}
          >
            <div className="h-1.5 w-12 rounded-full bg-muted-foreground/40 mb-2" />
            <p className="text-sm font-semibold text-foreground">
              {courts.length >= 100 ? `Over ${Math.floor(courts.length / 100) * 100}` : courts.length} court{courts.length !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-muted-foreground">Drag up to explore</p>
          </div>

          {/* Scrollable cards list with improved gesture handling */}
          <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto min-h-0"
            style={{
              WebkitOverflowScrolling: 'touch',
              overscrollBehaviorY: 'contain',
              touchAction: 'pan-y',
            }}
          >
            <div className={cn("p-4 space-y-4", showPaginationControls ? "pb-28" : "pb-6")}>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-[4/3] bg-muted rounded-xl mb-3" />
                    <div className="h-5 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </div>
                ))
              ) : paginatedCourts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No courts found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {paginatedCourts.map((court) => (
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

          {/* Pagination controls */}
          {showPaginationControls && (
            <div 
              className={cn(
                "absolute bottom-0 left-0 right-0 flex items-center justify-center gap-6 py-4 px-6 bg-gradient-to-t from-background via-background to-transparent transition-all duration-300",
                showPagination ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
              )}
              style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
            >
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full shadow-lg border-2 disabled:opacity-40"
                onClick={handlePrevPage}
                disabled={!hasPrevPage}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              
              <span className="text-sm font-medium text-muted-foreground min-w-[60px] text-center">
                {currentPage} / {totalPages}
              </span>
              
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full shadow-lg border-2 disabled:opacity-40"
                onClick={handleNextPage}
                disabled={!hasNextPage}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          )}
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}
