import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MapPin, ArrowRight, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

const VENUES_PER_PAGE = 19;

export default function VenueDirectory() {
  const { t } = useTranslation(["discover", "courts", "common"]);
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);

  const { data: venues, isLoading } = useQuery({
    queryKey: ["venue-directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venues")
        .select("id, name, slug, city, suburb, description, photo_url, amenities")
        .eq("is_active", true)
        .not("slug", "is", null)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const totalPages = venues ? Math.ceil(venues.length / VENUES_PER_PAGE) : 1;
  const paginatedVenues = venues?.slice(
    (currentPage - 1) * VENUES_PER_PAGE,
    currentPage * VENUES_PER_PAGE
  );

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 py-10">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5 text-muted-foreground bg-transparent hover:bg-transparent hover:font-semibold hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" />
          {t("common:back", "Back")}
        </Button>
        <div className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold">{t("courts:venues", "Venues")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("discover:browseVenuesDesc", "Browse our partner venues and book courts directly.")}
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-56 rounded-lg" />
            ))}
          </div>
        ) : paginatedVenues && paginatedVenues.length > 0 ? (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedVenues.map((venue) => (
                <Link key={venue.id} to={`/venue/${venue.slug}`}>
                  <Card className="overflow-hidden hover:shadow-md hover:border-primary/50 transition-all h-full">
                    {venue.photo_url ? (
                      <div className="h-40 overflow-hidden">
                        <img
                          src={venue.photo_url}
                          alt={venue.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="h-40 bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
                        <MapPin className="h-10 w-10 text-primary/40" />
                      </div>
                    )}
                    <CardContent className="p-4 space-y-2">
                      <h2 className="font-semibold text-lg">{venue.name}</h2>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>
                          {venue.city}
                          {venue.suburb ? `, ${venue.suburb}` : ""}
                        </span>
                      </div>
                      {venue.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {venue.description}
                        </p>
                      )}
                      {venue.amenities && venue.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {venue.amenities.slice(0, 3).map((a: string) => (
                            <Badge key={a} variant="secondary" className="text-xs capitalize">
                              {a}
                            </Badge>
                          ))}
                          {venue.amenities.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{venue.amenities.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-sm text-primary font-medium pt-1">
                        {t("discover:viewVenue", "View venue")} <ArrowRight className="h-3.5 w-3.5" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => { setCurrentPage((p) => p - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {t("discover:prev", "Previous")}
                </Button>
                <span className="text-sm text-muted-foreground px-3">
                  {t("discover:page", { current: currentPage, total: totalPages, defaultValue: `Page ${currentPage} of ${totalPages}` })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => { setCurrentPage((p) => p + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                >
                  {t("discover:next", "Next")}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <MapPin className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h2 className="font-semibold text-lg mb-1">{t("courts:noVenuesFound", "No venues available yet")}</h2>
            <p className="text-muted-foreground">{t("courts:noVenuesFoundDesc", "Check back soon for new venue listings.")}</p>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
