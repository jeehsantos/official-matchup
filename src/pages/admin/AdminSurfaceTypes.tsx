import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Layers,
  GripVertical
} from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SurfaceType {
  id: string;
  name: string;
  display_name: string;
  is_active: boolean;
  sort_order: number;
}

function AdminSurfaceTypesContent() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [surfaces, setSurfaces] = useState<SurfaceType[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingSurface, setEditingSurface] = useState<SurfaceType | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    display_name: "",
    is_active: true,
    sort_order: 0,
  });

  useEffect(() => {
    fetchSurfaces();
  }, []);

  const fetchSurfaces = async () => {
    try {
      const { data, error } = await supabase
        .from("surface_types")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setSurfaces(data || []);
    } catch (error) {
      console.error("Error fetching surface types:", error);
      toast({
        title: "Error",
        description: "Failed to load surface types",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingSurface(null);
    setFormData({
      name: "",
      display_name: "",
      is_active: true,
      sort_order: surfaces.length,
    });
    setShowDialog(true);
  };

  const openEditDialog = (surface: SurfaceType) => {
    setEditingSurface(surface);
    setFormData({
      name: surface.name,
      display_name: surface.display_name,
      is_active: surface.is_active,
      sort_order: surface.sort_order,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.display_name) {
      toast({
        title: "Validation Error",
        description: "Name and display name are required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (editingSurface) {
        const { error } = await supabase
          .from("surface_types")
          .update({
            name: formData.name,
            display_name: formData.display_name,
            is_active: formData.is_active,
            sort_order: formData.sort_order,
          })
          .eq("id", editingSurface.id);

        if (error) throw error;
        toast({ title: "Surface type updated successfully" });
      } else {
        const { error } = await supabase
          .from("surface_types")
          .insert({
            name: formData.name,
            display_name: formData.display_name,
            is_active: formData.is_active,
            sort_order: formData.sort_order,
          });

        if (error) throw error;
        toast({ title: "Surface type created successfully" });
      }

      setShowDialog(false);
      fetchSurfaces();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save surface type",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this surface type?")) return;

    try {
      const { error } = await supabase
        .from("surface_types")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Surface type deleted successfully" });
      fetchSurfaces();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete surface type",
        variant: "destructive",
      });
    }
  };

  const toggleActive = async (surface: SurfaceType) => {
    try {
      const { error } = await supabase
        .from("surface_types")
        .update({ is_active: !surface.is_active })
        .eq("id", surface.id);

      if (error) throw error;
      fetchSurfaces();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update surface type",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Surface Types">
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Surface Types">
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>

        <div className="space-y-4">
          {surfaces.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No surface types found</p>
                <Button onClick={openCreateDialog} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Surface Type
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Surface Types ({surfaces.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {surfaces.map((surface) => (
                  <div
                    key={surface.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                      <div>
                        <p className="font-medium">{surface.display_name}</p>
                        <p className="text-sm text-muted-foreground">{surface.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={surface.is_active ? "default" : "secondary"}>
                        {surface.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Switch
                        checked={surface.is_active}
                        onCheckedChange={() => toggleActive(surface)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(surface)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(surface.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Create/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingSurface ? "Edit Surface Type" : "Add Surface Type"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Internal Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                  placeholder="e.g., grass"
                />
                <p className="text-xs text-muted-foreground">
                  Lowercase, no spaces (used in database)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="display_name">Display Name</Label>
                <Input
                  id="display_name"
                  value={formData.display_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                  placeholder="e.g., Grass"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sort_order">Sort Order</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingSurface ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

export default function AdminSurfaceTypes() {
  return (
    <ProtectedRoute requiredRole="admin">
      <AdminSurfaceTypesContent />
    </ProtectedRoute>
  );
}
