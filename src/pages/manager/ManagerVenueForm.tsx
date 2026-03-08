import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ManagerLayout } from "@/components/layout/ManagerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Venue = Database["public"]["Tables"]["venues"]["Row"];

const venueSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  city: z.string().min(2, "City must be at least 2 characters"),
  description: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  photo_url: z.string().url("Invalid URL").optional().or(z.literal("")),
  is_active: z.boolean(),
});

type VenueFormData = z.infer<typeof venueSchema>;

export default function ManagerVenueForm() {
  const { id } = useParams<{ id: string }>();
  const isEditing = id !== "new";
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<VenueFormData>({
    resolver: zodResolver(venueSchema),
    defaultValues: {
      is_active: true,
    },
  });

  useEffect(() => {
    if (isEditing && id) {
      fetchVenue();
    }
  }, [id, isEditing]);

  const fetchVenue = async () => {
    try {
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .eq("id", id)
        .eq("owner_id", user?.id)
        .single();

      if (error) throw error;
      
      reset({
        name: data.name,
        address: data.address,
        city: data.city,
        description: data.description || "",
        phone: data.phone || "",
        email: data.email || "",
        photo_url: data.photo_url || "",
        is_active: data.is_active ?? true,
      });
    } catch (error) {
      console.error("Error fetching venue:", error);
      navigate("/manager/venues");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: VenueFormData) => {
    if (!user) return;
    
    setSubmitting(true);
    try {
      if (isEditing) {
        const { error } = await supabase
          .from("venues")
          .update({
            name: data.name,
            address: data.address,
            city: data.city,
            description: data.description || null,
            phone: data.phone || null,
            email: data.email || null,
            photo_url: data.photo_url || null,
            is_active: data.is_active,
          })
          .eq("id", id)
          .eq("owner_id", user.id);

        if (error) throw error;
        
        toast({ title: "Venue updated successfully" });
      } else {
        // Check if user has a Stripe account on their profile to auto-attach
        const { data: profile } = await supabase
          .from("profiles")
          .select("stripe_account_id")
          .eq("user_id", user.id)
          .single();

        const { error } = await supabase
          .from("venues")
          .insert({
            owner_id: user.id,
            name: data.name,
            address: data.address,
            city: data.city,
            description: data.description || null,
            phone: data.phone || null,
            email: data.email || null,
            photo_url: data.photo_url || null,
            is_active: data.is_active,
            stripe_account_id: (profile as any)?.stripe_account_id || null,
          });

        if (error) throw error;
        
        toast({ title: "Venue created successfully" });
      }
      
      navigate("/manager/venues");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save venue",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this venue? This will also delete all associated courts.")) {
      return;
    }

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("venues")
        .delete()
        .eq("id", id)
        .eq("owner_id", user?.id);

      if (error) throw error;
      
      toast({ title: "Venue deleted successfully" });
      navigate("/manager/venues");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete venue",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <ManagerLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold">
              {isEditing ? "Edit Venue" : "Add Venue"}
            </h1>
            <p className="text-muted-foreground">
              {isEditing ? "Update venue details" : "Register a new sports venue"}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Venue Name *</Label>
                <Input
                  id="name"
                  {...register("name")}
                  placeholder="e.g., Auckland Sports Center"
                  className="mt-1"
                />
                {errors.name && (
                  <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="address">Address *</Label>
                <Input
                  id="address"
                  {...register("address")}
                  placeholder="e.g., 123 Sports Lane"
                  className="mt-1"
                />
                {errors.address && (
                  <p className="text-sm text-destructive mt-1">{errors.address.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  {...register("city")}
                  placeholder="e.g., Auckland"
                  className="mt-1"
                />
                {errors.city && (
                  <p className="text-sm text-destructive mt-1">{errors.city.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...register("description")}
                  placeholder="Tell players about your venue..."
                  rows={3}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  {...register("phone")}
                  placeholder="e.g., 09 123 4567"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...register("email")}
                  placeholder="e.g., info@venue.co.nz"
                  className="mt-1"
                />
                {errors.email && (
                  <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Media</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="photo_url">Photo URL</Label>
                <Input
                  id="photo_url"
                  {...register("photo_url")}
                  placeholder="https://example.com/photo.jpg"
                  className="mt-1"
                />
                {errors.photo_url && (
                  <p className="text-sm text-destructive mt-1">{errors.photo_url.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="is_active">Active</Label>
                  <p className="text-sm text-muted-foreground">
                    Inactive venues won't appear in search results
                  </p>
                </div>
                <Switch
                  id="is_active"
                  checked={watch("is_active")}
                  onCheckedChange={(checked) => setValue("is_active", checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                isEditing ? "Update Venue" : "Create Venue"
              )}
            </Button>
            
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </form>
      </div>
    </ManagerLayout>
  );
}
