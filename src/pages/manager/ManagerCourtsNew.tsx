import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ManagerLayout } from "@/components/layout/ManagerLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SportIcon, getSportLabel } from "@/components/ui/sport-icon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { 
  Building2, 
  Plus,
  MapPin,
  DollarSign,
  Edit,
  Loader2,
  Users,
  Trash2,
  Pencil,
  Check,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useManagerStripeReady } from "@/hooks/useStripeConnectStatus";
import { StripeSetupAlert } from "@/components/manager/StripeSetupAlert";

interface Venue {
  id: string;
  name: string;
  city: string;
  address: string;
}

interface Court {
  id: string;
  name: string;
  allowed_sports: string[] | null;
  capacity: number;
  hourly_rate: number;
  is_indoor: boolean;
  is_active: boolean;
  photo_url: string | null;
  venue_id: string;
  parent_court_id: string | null;
}

interface VenueWithCourts {
  venue: Venue;
  courts: Court[];
}

export default function ManagerCourtsNew() {
  const { t } = useTranslation("manager");
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: stripeStatus, isLoading: stripeLoading } = useManagerStripeReady();
  const [venueGroups, setVenueGroups] = useState<VenueWithCourts[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Court | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editingVenueId, setEditingVenueId] = useState<string | null>(null);
  const [editingVenueName, setEditingVenueName] = useState("");
  const [savingVenueName, setSavingVenueName] = useState(false);
  const [addCourtVenue, setAddCourtVenue] = useState<{ venue: Venue; courts: Court[] } | null>(null);

  const startEditingVenue = (venue: Venue) => {
    setEditingVenueId(venue.id);
    setEditingVenueName(venue.name);
  };

  const cancelEditingVenue = () => {
    setEditingVenueId(null);
    setEditingVenueName("");
  };

  const saveVenueName = async (venueId: string) => {
    const trimmed = editingVenueName.trim();
    if (!trimmed) {
      toast({ title: t("courts.venueNameEmpty"), variant: "destructive" });
      return;
    }
    setSavingVenueName(true);
    try {
      const { error } = await supabase
        .from("venues")
        .update({ name: trimmed })
        .eq("id", venueId);
      if (error) throw error;
      setVenueGroups(prev =>
        prev.map(g =>
          g.venue.id === venueId
            ? { ...g, venue: { ...g.venue, name: trimmed } }
            : g
        )
      );
      toast({ title: t("courts.venueNameUpdated") });
      setEditingVenueId(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingVenueName(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const { data: venues, error: venuesError } = await supabase
        .from("venues")
        .select("id, name, city, address")
        .eq("owner_id", user?.id)
        .order("created_at", { ascending: false });

      if (venuesError) throw venuesError;
      if (!venues || venues.length === 0) {
        setVenueGroups([]);
        setLoading(false);
        return;
      }

      const venueIds = venues.map(v => v.id);

      const { data: courts, error: courtsError } = await supabase
        .from("courts")
        .select("id, name, allowed_sports, capacity, hourly_rate, is_indoor, is_active, photo_url, venue_id, parent_court_id")
        .in("venue_id", venueIds)
        .order("created_at", { ascending: false });

      if (courtsError) throw courtsError;

      const groups: VenueWithCourts[] = venues.map(venue => ({
        venue,
        courts: (courts || []).filter(c => c.venue_id === venue.id),
      }));

      setVenueGroups(groups);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const { count, error: countError } = await supabase
        .from("court_availability")
        .select("id", { count: "exact", head: true })
        .eq("court_id", deleteTarget.id)
        .eq("is_booked", true);

      if (countError) throw countError;

      if (count && count > 0) {
        toast({
          title: t("courts.cannotDelete"),
          description: t("courts.cannotDeleteDesc"),
          variant: "destructive",
        });
        setDeleteTarget(null);
        return;
      }

      const { error } = await supabase
        .from("courts")
        .delete()
        .eq("id", deleteTarget.id);

      if (error) throw error;

      toast({ title: t("courts.courtDeleted") });
      setVenueGroups(prev =>
        prev.map(g => ({
          ...g,
          courts: g.courts.filter(c => c.id !== deleteTarget.id),
        }))
      );
      setDeleteTarget(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete court",
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <ManagerLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">{t("courts.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("courts.subtitle")}</p>
          </div>
          <Link to="/manager/courts/new">
            <Button className="gap-2" disabled={!stripeStatus?.isReady}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{t("courts.addNewVenue")}</span>
              <span className="sm:hidden">{t("courts.add")}</span>
            </Button>
          </Link>
        </div>

        {/* Stripe Setup Warning */}
        {!stripeLoading && !stripeStatus?.isReady && (
          <StripeSetupAlert hasVenues={stripeStatus?.hasVenues ?? false} />
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : venueGroups.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">{t("courts.noVenuesYet")}</h3>
              <p className="text-muted-foreground mb-4">
                {t("courts.noVenuesDesc")}
              </p>
              <Link to="/manager/courts/new">
                <Button>{t("courts.addFirstVenue")}</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {venueGroups.map(({ venue, courts }) => (
              <Card key={venue.id} className="overflow-hidden">
                <CardContent className="p-4 md:p-6">
                  {/* Venue Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {editingVenueId === venue.id ? (
                          <>
                            <Input
                              value={editingVenueName}
                              onChange={(e) => setEditingVenueName(e.target.value)}
                              className="h-8 text-lg font-bold max-w-[240px]"
                              autoFocus
                              disabled={savingVenueName}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveVenueName(venue.id);
                                if (e.key === "Escape") cancelEditingVenue();
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={savingVenueName}
                              onClick={() => saveVenueName(venue.id)}
                            >
                              {savingVenueName ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={savingVenueName}
                              onClick={cancelEditingVenue}
                            >
                              <X className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <h2 className="text-lg md:text-xl font-bold">{venue.name}</h2>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => startEditingVenue(venue)}
                            >
                              <Pencil className="h-3.5 w-3.5 text-primary" />
                            </Button>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {venue.city}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={!stripeStatus?.isReady}
                      onClick={() => {
                        // Filter to only main courts (no parent_court_id) for parent selection
                        const mainCourts = courts.filter(c => !c.parent_court_id);
                        if (mainCourts.length === 0) {
                          // No courts yet — create the first court for this venue
                          navigate(`/manager/courts/new?venue_id=${venue.id}`);
                        } else {
                          setAddCourtVenue({ venue, courts: mainCourts });
                        }
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {t("courts.addCourt")}
                    </Button>
                  </div>

                  {/* Courts Grid */}
                  {courts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                      {t("courts.noCourtsAddedYet")}
                    </div>
                  ) : (
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                      {courts.map((court) => (
                        <div key={court.id} className="rounded-lg border bg-card overflow-hidden">
                          {/* Court Image */}
                          <div className="h-36 bg-muted relative">
                            {court.photo_url ? (
                              <img
                                src={court.photo_url}
                                alt={court.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <SportIcon sport={court.allowed_sports?.[0] || "other"} size="lg" />
                              </div>
                            )}
                            <div className="absolute top-2 right-2 flex gap-1.5">
                              <Badge
                                variant={court.is_active ? "default" : "destructive"}
                                className="text-[11px] px-2 py-0.5"
                              >
                                {court.is_active ? t("courts.active") : t("courts.maintenance")}
                              </Badge>
                              <Badge variant="outline" className="bg-background/80 text-[11px] px-2 py-0.5">
                                {court.is_indoor ? t("courts.indoor") : t("courts.outdoor")}
                              </Badge>
                            </div>
                          </div>

                          {/* Court Info */}
                          <div className="p-3 space-y-3">
                            <div>
                              <h3 className="font-semibold text-sm">{court.name}</h3>
                              <p className="text-xs text-muted-foreground">
                                {getSportLabel(court.allowed_sports?.[0] || "other")}
                              </p>
                            </div>

                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Users className="h-3 w-3" />
                                {court.capacity} {t("courts.playersMax")}
                              </div>
                              <div className="flex items-center gap-0.5 font-semibold text-primary">
                                <DollarSign className="h-3 w-3" />
                                {court.hourly_rate.toFixed(2)}<span className="text-muted-foreground font-normal">{t("courts.perHour")}</span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                              <Link to={`/manager/courts/${court.id}/edit`} className="flex-1">
                                <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs h-8">
                                  <Edit className="h-3 w-3" />
                                  {t("courts.editCourt")}
                                </Button>
                              </Link>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => setDeleteTarget(court)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("courts.deleteTitle")} "{deleteTarget?.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                {t("courts.deleteDesc")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteLoading}>{t("courts.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteLoading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
              >
                {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {t("courts.deleteTitle")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Select Parent Court Dialog */}
        <AlertDialog open={!!addCourtVenue} onOpenChange={(open) => !open && setAddCourtVenue(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("courts.selectMainCourt", "Select Main Court")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("courts.selectMainCourtDesc", "Choose the main court that the new sub-court will belong to. This enables multi-court configuration.")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2 py-2">
              {addCourtVenue?.courts.map((court) => (
                <button
                  key={court.id}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors text-left"
                  onClick={() => {
                    setAddCourtVenue(null);
                    navigate(`/manager/courts/${court.id}/edit?add_subcourt=true`);
                  }}
                >
                  <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <SportIcon sport={court.allowed_sports?.[0] || "other"} size="sm" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{court.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {getSportLabel(court.allowed_sports?.[0] || "other")} · ${court.hourly_rate.toFixed(2)}/hr
                    </p>
                  </div>
                </button>
              ))}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("courts.cancel")}</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ManagerLayout>
  );
}
