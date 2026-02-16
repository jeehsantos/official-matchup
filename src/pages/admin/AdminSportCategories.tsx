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
  Activity,
  GripVertical
} from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SportCategory {
  id: string;
  name: string;
  display_name: string;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
}

function AdminSportCategoriesContent() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<SportCategory[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SportCategory | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    display_name: "",
    icon: "",
    is_active: true,
    sort_order: 0,
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("sport_categories")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error("Error fetching sport categories:", error);
      toast({
        title: "Error",
        description: "Failed to load sport categories",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingCategory(null);
    setFormData({
      name: "",
      display_name: "",
      icon: "",
      is_active: true,
      sort_order: categories.length,
    });
    setShowDialog(true);
  };

  const openEditDialog = (category: SportCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      display_name: category.display_name,
      icon: category.icon || "",
      is_active: category.is_active,
      sort_order: category.sort_order,
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
      if (editingCategory) {
        const { error } = await supabase
          .from("sport_categories")
          .update({
            name: formData.name,
            display_name: formData.display_name,
            icon: formData.icon || null,
            is_active: formData.is_active,
            sort_order: formData.sort_order,
          })
          .eq("id", editingCategory.id);

        if (error) throw error;
        toast({ title: "Category updated successfully" });
      } else {
        const { error } = await supabase
          .from("sport_categories")
          .insert({
            name: formData.name,
            display_name: formData.display_name,
            icon: formData.icon || null,
            is_active: formData.is_active,
            sort_order: formData.sort_order,
          });

        if (error) throw error;
        toast({ title: "Category created successfully" });
      }

      setShowDialog(false);
      fetchCategories();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save category",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;

    try {
      const { error } = await supabase
        .from("sport_categories")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Category deleted successfully" });
      fetchCategories();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete category",
        variant: "destructive",
      });
    }
  };

  const toggleActive = async (category: SportCategory) => {
    try {
      const { error } = await supabase
        .from("sport_categories")
        .update({ is_active: !category.is_active })
        .eq("id", category.id);

      if (error) throw error;
      fetchCategories();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update category",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Sport Categories">
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Sport Categories">
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>

        <div className="space-y-4">
          {categories.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No sport categories found</p>
                <Button onClick={openCreateDialog} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Category
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Sport Categories ({categories.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                      <div>
                        <p className="font-medium">{category.display_name}</p>
                        <p className="text-sm text-muted-foreground">{category.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={category.is_active ? "default" : "secondary"}>
                        {category.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Switch
                        checked={category.is_active}
                        onCheckedChange={() => toggleActive(category)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(category)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(category.id)}
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
                {editingCategory ? "Edit Sport Category" : "Add Sport Category"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Internal Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                  placeholder="e.g., futsal"
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
                  placeholder="e.g., Futsal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="icon">Icon (optional)</Label>
                <Input
                  id="icon"
                  value={formData.icon}
                  onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                  placeholder="e.g., ⚽ or icon name"
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
                {editingCategory ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

export default function AdminSportCategories() {
  return (
    <ProtectedRoute requiredRole="admin">
      <AdminSportCategoriesContent />
    </ProtectedRoute>
  );
}
