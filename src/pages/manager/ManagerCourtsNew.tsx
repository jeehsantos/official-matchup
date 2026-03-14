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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  Settings,
  AlertTriangle,
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
  is_multi_court: boolean | null;
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

  // Venue Edit Dialog state
  const [editVenue, setEditVenue] = useState<{ venue: Venue; courts: Court[] } | null>(null);
  const [editVenueName, setEditVenueName] = useState("");
  const [editMainCourtId, setEditMainCourtId] = useState<string | null>(null);
  const [savingVenueEdit, setSavingVenueEdit] = useState(false);

  // Venue Delete state
  const [deleteVenueTarget, setDeleteVenueTarget] = useState<{ venue: Venue; courts: Court[] } | null>(null);
  const [deleteVenueLoading, setDeleteVenueLoading] = useState(false);

  const openVenueEditDialog = (venue: Venue, courts: Court[]) => {
    setEditVenueName(venue.name);
    // Find the current main court (is_multi_court=true and no parent)
    const mainCourt = courts.find(c => c.is_multi_court && !c.parent_court_id);
    setEditMainCourtId(mainCourt?.id || null);
    setEditVenue({ venue, courts });
  };

  const saveVenueEdit = async () => {
    if (!editVenue) return;
    const trimmed = editVenueName.trim();
    if (!trimmed) {
      toast({ title: t("courts.venueNameEmpty"), variant: "destructive" });
      return;
    }
    setSavingVenueEdit(true);
    try {
      // 1. Update venue name
      const { error: venueError } = await supabase
        .from("venues")
        .update({ name: trimmed })
        .eq("id", editVenue.venue.id);
      if (venueError) throw venueError;

      // 2. Update main court designation if changed
      const mainCourts = editVenue.courts.filter(c => !c.parent_court_id);
      if (editMainCourtId && mainCourts.length > 0) {
        // Set the selected court as main (is_multi_court=true, parent_court_id=null)
        const { error: mainError } = await supabase
          .from("courts")
          .update({ is_multi_court: true, parent_court_id: null } as any)
          .eq("id", editMainCourtId);
        if (mainError) throw mainError;

        // Set all OTHER top-level courts to have parent_court_id = mainCourtId
        const otherTopLevel = mainCourts.filter(c => c.id !== editMainCourtId);
        for (const court of otherTopLevel) {
          const { error } = await supabase
            .from("courts")
            .update({ parent_court_id: editMainCourtId } as any)
            .eq("id", court.id);
          if (error) throw error;
        }

        // Also update existing sub-courts to point to new main
        const existingChildren = editVenue.courts.filter(c => c.parent_court_id);
        for (const court of existingChildren) {
          if (court.parent_court_id !== editMainCourtId) {
            const { error } = await supabase
              .from("courts")
              .update({ parent_court_id: editMainCourtId } as any)
              .eq("id", court.id);
            if (error) throw error;
          }
        }
      }

      // Update local state
      setVenueGroups(prev =>
        prev.map(g =>
          g.venue.id === editVenue.venue.id
            ? { ...g, venue: { ...g.venue, name: trimmed } }
            : g
        )
      );
      toast({ title: t("courts.venueNameUpdated") });
      setEditVenue(null);
      // Re-fetch to get updated court relationships
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingVenueEdit(false);
    }
  };

  const handleDeleteVenue = async () => {
    if (!deleteVenueTarget) return;
    setDeleteVenueLoading(true);
    try {
      const courtIds = deleteVenueTarget.courts.map(c => c.id);

      if (courtIds.length > 0) {
        // Check for active bookings
        const { count, error: countError } = await supabase
          .from("court_availability")
          .select("id", { count: "exact", head: true })
          .in("court_id", courtIds)
          .eq("is_booked", true);

        if (countError) throw countError;

        if (count && count > 0) {
          toast({
            title: "Cannot delete venue",
            description: "This venue has active bookings. Cancel them first before deleting.",
            variant: "destructive",
          });
          setDeleteVenueTarget(null);
          return;
        }

        // Delete court_availability for all courts
        const { error: caError } = await supabase
          .from("court_availability")
          .delete()
          .in("court_id", courtIds);
        if (caError) throw caError;

        // Delete sub-courts first (children), then main courts
        const childCourts = deleteVenueTarget.courts.filter(c => c.parent_court_id);
        const mainCourts = deleteVenueTarget.courts.filter(c => !c.parent_court_id);

        for (const court of childCourts) {
          const { error } = await supabase.from("courts").delete().eq("id", court.id);
          if (error) throw error;
        }
        for (const court of mainCourts) {
          const { error } = await supabase.from("courts").delete().eq("id", court.id);
          if (error) throw error;
        }
      }

      // Delete the venue
      const { error: venueError } = await supabase
        .from("venues")
        .delete()
        .eq("id", deleteVenueTarget.venue.id);
      if (venueError) throw venueError;

      toast({ title: "Venue deleted successfully" });
      setVenueGroups(prev => prev.filter(g => g.venue.id !== deleteVenueTarget.venue.id));
      setDeleteVenueTarget(null);
      setEditVenue(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete venue",
        variant: "destructive",
      });
    } finally {
      setDeleteVenueLoading(false);
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
        .select("id, name, allowed_sports, capacity, hourly_rate, is_indoor, is_active, photo_url, venue_id, parent_court_id, is_multi_court")
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

  const handleAddCourt = (venue: Venue, courts: Court[]) => {
    if (courts.length === 0) {
      // No courts yet — create the first court
      navigate(`/manager/courts/new?venue_id=${venue.id}`);
      return;
    }

    // Find the main court (is_multi_court=true, no parent)
    const mainCourt = courts.find(c => c.is_multi_court && !c.parent_court_id);

    if (!mainCourt) {
      // No main court designated — warn user
      toast({
        title: "Main court required",
        description: "Please select a main court in the venue settings (pencil icon) before adding a second court.",
        variant: "destructive",
      });
      return;
    }

    // Navigate to add sub-court
    navigate(`/manager/courts/${mainCourt.id}/edit?add_subcourt=true`);
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
                        <h2 className="text-lg md:text-xl font-bold">{venue.name}</h2>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openVenueEditDialog(venue, courts)}
                        >
                          <Settings className="h-3.5 w-3.5 text-primary" />
                        </Button>
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
                      onClick={() => handleAddCourt(venue, courts)}
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

        {/* Delete Court Confirmation Dialog */}
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

        {/* Venue Edit Dialog */}
        <Dialog open={!!editVenue} onOpenChange={(open) => !open && setEditVenue(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Venue Settings</DialogTitle>
              <DialogDescription>
                Edit venue name, designate a main court, or delete this venue.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              {/* Venue Name */}
              <div className="space-y-1.5">
                <Label>Venue Name</Label>
                <Input
                  value={editVenueName}
                  onChange={(e) => setEditVenueName(e.target.value)}
                  placeholder="Venue name"
                />
              </div>

              {/* Main Court Selection */}
              {editVenue && editVenue.courts.length > 0 && (
                <div className="space-y-2">
                  <Label>Main Court</Label>
                  <p className="text-xs text-muted-foreground">
                    Select which court is the main court. Other courts will become sub-courts.
                  </p>
                  <RadioGroup
                    value={editMainCourtId || ""}
                    onValueChange={(value) => setEditMainCourtId(value)}
                  >
                    {editVenue.courts
                      .filter(c => !c.parent_court_id || c.id === editMainCourtId)
                      .map((court) => (
                        <div key={court.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                          <RadioGroupItem value={court.id} id={`court-${court.id}`} />
                          <Label htmlFor={`court-${court.id}`} className="flex-1 cursor-pointer">
                            <span className="font-medium text-sm">{court.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              ${court.hourly_rate.toFixed(2)}/hr
                            </span>
                          </Label>
                        </div>
                      ))}
                  </RadioGroup>
                </div>
              )}

              {/* Delete Venue */}
              <div className="pt-3 border-t border-border">
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => {
                    if (editVenue) {
                      setDeleteVenueTarget(editVenue);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Venue
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditVenue(null)}>
                Cancel
              </Button>
              <Button onClick={saveVenueEdit} disabled={savingVenueEdit}>
                {savingVenueEdit && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Venue Confirmation */}
        <AlertDialog open={!!deleteVenueTarget} onOpenChange={(open) => !open && setDeleteVenueTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Delete "{deleteVenueTarget?.venue.name}"?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the venue and all its courts. This action cannot be undone.
                {deleteVenueTarget && deleteVenueTarget.courts.length > 0 && (
                  <span className="block mt-2 font-medium text-foreground">
                    {deleteVenueTarget.courts.length} court{deleteVenueTarget.courts.length > 1 ? "s" : ""} will be deleted.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteVenueLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteVenueLoading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteVenue();
                }}
              >
                {deleteVenueLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Delete Venue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ManagerLayout>
  );
}
