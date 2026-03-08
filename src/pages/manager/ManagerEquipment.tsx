import { useState, useEffect, useRef } from "react";
import { ManagerLayout } from "@/components/layout/ManagerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Loader2, Package, Edit, Trash2, ImagePlus, X, Camera, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  useVenueEquipment, useCreateEquipment, useUpdateEquipment, useDeleteEquipment, type Equipment,
} from "@/hooks/useVenueEquipment";
import { useManagerVenues } from "@/hooks/useManagerVenues";
import { useTranslation } from "react-i18next";

export default function ManagerEquipment() {
  const { user } = useAuth();
  const { t } = useTranslation("manager");
  const { data: venues = [], isLoading: loadingVenues } = useManagerVenues();
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: "", description: "", price_per_unit: 0, quantity_available: 1, photo_url: "",
  });

  useEffect(() => {
    if (venues.length > 0 && !selectedVenueId) setSelectedVenueId(venues[0].id);
  }, [venues, selectedVenueId]);

  const { data: equipment = [], isLoading: loadingEquipment } = useVenueEquipment(selectedVenueId);
  const createMutation = useCreateEquipment();
  const updateMutation = useUpdateEquipment();
  const deleteMutation = useDeleteEquipment();

  const resetForm = () => { setFormData({ name: "", description: "", price_per_unit: 0, quantity_available: 1, photo_url: "" }); setEditingEquipment(null); };

  const openEditDialog = (item: Equipment) => {
    setEditingEquipment(item);
    setFormData({ name: item.name, description: item.description || "", price_per_unit: item.price_per_unit, quantity_available: item.quantity_available, photo_url: item.photo_url || "" });
    setDialogOpen(true);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be less than 5MB"); return; }
    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `equipment/${fileName}`;
      const { error: uploadError } = await supabase.storage.from("court-photos").upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("court-photos").getPublicUrl(filePath);
      setFormData({ ...formData, photo_url: publicUrl });
      toast.success("Photo uploaded successfully");
    } catch (error: any) { console.error("Error uploading photo:", error); toast.error(error.message || "Failed to upload photo"); } finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVenueId) return;
    if (editingEquipment) await updateMutation.mutateAsync({ id: editingEquipment.id, ...formData });
    else await createMutation.mutateAsync({ venue_id: selectedVenueId, ...formData });
    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = async (item: Equipment) => {
    if (!selectedVenueId) return;
    await deleteMutation.mutateAsync({ id: item.id, venueId: selectedVenueId });
  };

  if (loadingVenues) {
    return (<ManagerLayout><div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></ManagerLayout>);
  }

  if (venues.length === 0) {
    return (
      <ManagerLayout>
        <div className="p-4 md:p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="font-semibold text-lg mb-2">{t("equipment.noVenuesFound")}</h2>
              <p className="text-muted-foreground mb-4">{t("equipment.noVenuesDesc")}</p>
              <Button onClick={() => window.location.href = "/manager/courts/new"}>{t("equipment.createCourt")}</Button>
            </CardContent>
          </Card>
        </div>
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">{t("equipment.title")}</h1>
            <p className="text-muted-foreground">{t("equipment.subtitle")}</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />{t("equipment.addEquipment")}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingEquipment ? t("equipment.editEquipment") : t("equipment.addNewEquipment")}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>{t("equipment.equipmentPhoto")}</Label>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                  {formData.photo_url ? (
                    <div className="relative group mt-2">
                      <div className="aspect-video rounded-lg overflow-hidden border border-border bg-muted">
                        <img src={formData.photo_url} alt="Equipment preview" className="w-full h-full object-cover" />
                      </div>
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                        <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                          <Camera className="h-4 w-4 mr-1" />{t("equipment.change")}
                        </Button>
                        <Button type="button" variant="destructive" size="sm" onClick={() => setFormData({ ...formData, photo_url: "" })}>
                          <X className="h-4 w-4 mr-1" />{t("equipment.remove")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full aspect-video mt-2 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 bg-muted/30 hover:bg-muted/50 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50">
                      {uploading ? (<><Loader2 className="h-6 w-6 text-muted-foreground animate-spin" /><span className="text-sm text-muted-foreground">{t("equipment.uploading")}</span></>) : (<><ImagePlus className="h-6 w-6 text-muted-foreground" /><span className="text-sm text-muted-foreground">{t("equipment.uploadPhoto")}</span></>)}
                    </button>
                  )}
                </div>
                <div>
                  <Label htmlFor="name">{t("equipment.equipmentName")}</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Tennis Racket" required />
                </div>
                <div>
                  <Label htmlFor="description">{t("equipment.descriptionLabel")}</Label>
                  <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder={t("equipment.descriptionPlaceholder")} rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price">{t("equipment.pricePerUnit")}</Label>
                    <Input id="price" type="number" step="0.01" min="0" value={formData.price_per_unit} onChange={(e) => setFormData({ ...formData, price_per_unit: parseFloat(e.target.value) || 0 })} required />
                  </div>
                  <div>
                    <Label htmlFor="quantity">{t("equipment.quantityAvailable")}</Label>
                    <Input id="quantity" type="number" min="1" value={formData.quantity_available} onChange={(e) => setFormData({ ...formData, quantity_available: parseInt(e.target.value) || 1 })} required />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t("equipment.cancel")}</Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingEquipment ? t("equipment.update") : t("equipment.addEquipment")}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {venues.length > 1 && (
          <Card>
            <CardContent className="py-4">
              <Label>{t("equipment.selectVenue")}</Label>
              <Select value={selectedVenueId || ""} onValueChange={setSelectedVenueId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={t("equipment.selectVenue")} /></SelectTrigger>
                <SelectContent>
                  {venues.map((venue) => (<SelectItem key={venue.id} value={venue.id}>{venue.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("equipment.equipmentAt")} {venues.find(v => v.id === selectedVenueId)?.name}</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingEquipment ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : equipment.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>{t("equipment.noEquipmentYet")}</p>
                <p className="text-sm">{t("equipment.noEquipmentDesc")}</p>
              </div>
            ) : (
              <div className="divide-y">
                {equipment.map((item) => (
                  <div key={item.id} className="py-4 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                      {item.photo_url ? (
                        <img src={item.photo_url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-6 w-6 text-muted-foreground/50" /></div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.name}</span>
                        {!item.is_active && <Badge variant="secondary">Inactive</Badge>}
                      </div>
                      {item.description && <p className="text-sm text-muted-foreground truncate">{item.description}</p>}
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span>${item.price_per_unit.toFixed(2)} {t("equipment.perUnit")}</span>
                        <span>•</span>
                        <span>{item.quantity_available} {t("equipment.available")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}><Edit className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("equipment.deleteEquipment")}</AlertDialogTitle>
                            <AlertDialogDescription>{t("equipment.deleteConfirm", { name: item.name })}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("equipment.cancel")}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(item)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("equipment.delete")}</AlertDialogAction>
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
