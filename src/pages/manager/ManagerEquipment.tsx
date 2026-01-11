import { useState, useEffect } from "react";
import { ManagerLayout } from "@/components/layout/ManagerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Loader2, Package, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  useVenueEquipment,
  useCreateEquipment,
  useUpdateEquipment,
  useDeleteEquipment,
  type Equipment,
} from "@/hooks/useVenueEquipment";

interface Venue {
  id: string;
  name: string;
}

export default function ManagerEquipment() {
  const { user } = useAuth();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price_per_unit: 0,
    quantity_available: 1,
  });

  const { data: equipment = [], isLoading: loadingEquipment } = useVenueEquipment(selectedVenueId);
  const createMutation = useCreateEquipment();
  const updateMutation = useUpdateEquipment();
  const deleteMutation = useDeleteEquipment();

  useEffect(() => {
    if (user) {
      fetchVenues();
    }
  }, [user]);

  const fetchVenues = async () => {
    try {
      const { data, error } = await supabase
        .from("venues")
        .select("id, name")
        .eq("owner_id", user?.id)
        .eq("is_active", true);

      if (error) throw error;
      setVenues(data || []);
      if (data && data.length > 0) {
        setSelectedVenueId(data[0].id);
      }
    } catch (error) {
      console.error("Error fetching venues:", error);
    } finally {
      setLoadingVenues(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price_per_unit: 0,
      quantity_available: 1,
    });
    setEditingEquipment(null);
  };

  const openEditDialog = (item: Equipment) => {
    setEditingEquipment(item);
    setFormData({
      name: item.name,
      description: item.description || "",
      price_per_unit: item.price_per_unit,
      quantity_available: item.quantity_available,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVenueId) return;

    if (editingEquipment) {
      await updateMutation.mutateAsync({
        id: editingEquipment.id,
        ...formData,
      });
    } else {
      await createMutation.mutateAsync({
        venue_id: selectedVenueId,
        ...formData,
      });
    }

    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = async (item: Equipment) => {
    if (!selectedVenueId) return;
    await deleteMutation.mutateAsync({ id: item.id, venueId: selectedVenueId });
  };

  if (loadingVenues) {
    return (
      <ManagerLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ManagerLayout>
    );
  }

  if (venues.length === 0) {
    return (
      <ManagerLayout>
        <div className="p-4 md:p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="font-semibold text-lg mb-2">No Venues Found</h2>
              <p className="text-muted-foreground mb-4">
                You need to create a venue before adding equipment.
              </p>
              <Button onClick={() => window.location.href = "/manager/courts/new"}>
                Create a Court
              </Button>
            </CardContent>
          </Card>
        </div>
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Equipment Rental</h1>
            <p className="text-muted-foreground">
              Manage equipment available for hire at your venues
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Equipment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingEquipment ? "Edit Equipment" : "Add New Equipment"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Equipment Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Tennis Racket"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description..."
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price">Price per Unit (NZD) *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price_per_unit}
                      onChange={(e) => setFormData({ ...formData, price_per_unit: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="quantity">Quantity Available *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={formData.quantity_available}
                      onChange={(e) => setFormData({ ...formData, quantity_available: parseInt(e.target.value) || 1 })}
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {editingEquipment ? "Update" : "Add"} Equipment
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Venue Selector */}
        {venues.length > 1 && (
          <Card>
            <CardContent className="py-4">
              <Label>Select Venue</Label>
              <Select value={selectedVenueId || ""} onValueChange={setSelectedVenueId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a venue" />
                </SelectTrigger>
                <SelectContent>
                  {venues.map((venue) => (
                    <SelectItem key={venue.id} value={venue.id}>
                      {venue.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {/* Equipment List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Equipment at {venues.find(v => v.id === selectedVenueId)?.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingEquipment ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : equipment.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>No equipment added yet</p>
                <p className="text-sm">Add equipment that players can rent with their booking</p>
              </div>
            ) : (
              <div className="divide-y">
                {equipment.map((item) => (
                  <div key={item.id} className="py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.name}</span>
                        {!item.is_active && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-sm text-muted-foreground truncate">
                          {item.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span>${item.price_per_unit.toFixed(2)} / unit</span>
                        <span>•</span>
                        <span>{item.quantity_available} available</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(item)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Equipment</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{item.name}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(item)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ManagerLayout>
  );
}
