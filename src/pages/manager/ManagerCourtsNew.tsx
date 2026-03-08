import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
  Building2, 
  Plus,
  MapPin,
  DollarSign,
  Edit,
  Loader2,
  Users,
  Trash2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";

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
  venue?: {
    name: string;
    city: string;
    address: string;
  };
}

export default function ManagerCourtsNew() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Court | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchCourts();
    }
  }, [user]);

  const fetchCourts = async () => {
    try {
      // First get venues owned by user
      const { data: venues } = await supabase
        .from("venues")
        .select("id")
        .eq("owner_id", user?.id);

      if (!venues || venues.length === 0) {
        setCourts([]);
        setLoading(false);
        return;
      }

      const venueIds = venues.map(v => v.id);

      // Then get only parent courts (main venues) for those venues
      const { data, error } = await supabase
        .from("courts")
        .select(`
          *,
          venue:venues(name, city, address)
        `)
        .in("venue_id", venueIds)
        .is("parent_court_id", null) // Only show parent courts (main venues)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCourts(data || []);
    } catch (error) {
      console.error("Error fetching courts:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ManagerLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">My Venues</h1>
            <p className="text-muted-foreground">Manage your sports venues and courts</p>
          </div>
          <Link to="/manager/courts/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Venue
            </Button>
          </Link>
        </div>

        {/* Courts List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : courts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">No venues yet</h3>
              <p className="text-muted-foreground mb-4">
                Add your first venue to start receiving bookings.
              </p>
              <Link to="/manager/courts/new">
                <Button>Add Your First Venue</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courts.map((court) => (
              <Card key={court.id} className="overflow-hidden">
                {/* Image */}
                <div className="h-40 bg-muted relative">
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
                  <div className="absolute top-2 right-2 flex gap-2">
                    <Badge variant={court.is_active ? "default" : "secondary"}>
                      {court.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="outline" className="bg-background">
                      {court.is_indoor ? "Indoor" : "Outdoor"}
                    </Badge>
                  </div>
                </div>
                
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold">{court.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {getSportLabel(court.allowed_sports?.[0] || "other")}
                      </p>
                    </div>
                  </div>
                  
                  {court.venue && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                      <MapPin className="h-3 w-3" />
                      {court.venue.name}, {court.venue.city}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-sm mb-4">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {court.capacity} players
                    </div>
                    <div className="flex items-center gap-1 font-semibold text-primary">
                      <DollarSign className="h-3 w-3" />
                      {court.hourly_rate}/hr
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Link to={`/manager/courts/${court.id}/edit`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1">
                        <Edit className="h-3 w-3" />
                        Edit Venue
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteTarget(court)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. The venue and all its data will be permanently removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteLoading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async (e) => {
                  e.preventDefault();
                  if (!deleteTarget) return;
                  setDeleteLoading(true);
                  try {
                    // Check for active bookings
                    const { count, error: countError } = await supabase
                      .from("court_availability")
                      .select("id", { count: "exact", head: true })
                      .eq("court_id", deleteTarget.id)
                      .eq("is_booked", true);

                    if (countError) throw countError;

                    if (count && count > 0) {
                      toast({
                        title: "Cannot delete venue",
                        description: "This venue has active bookings. Please cancel all bookings first before deleting.",
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

                    toast({ title: "Venue deleted successfully" });
                    setCourts(courts.filter(c => c.id !== deleteTarget.id));
                    setDeleteTarget(null);
                  } catch (error: any) {
                    toast({
                      title: "Error",
                      description: error.message || "Failed to delete venue",
                      variant: "destructive",
                    });
                  } finally {
                    setDeleteLoading(false);
                  }
                }}
              >
                {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ManagerLayout>
  );
}
