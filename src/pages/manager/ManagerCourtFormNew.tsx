import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { ManagerLayout } from "@/components/layout/ManagerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Trash2, Building2, ExternalLink, Link as LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { CourtPhotosUpload } from "@/components/manager/CourtPhotosUpload";
import { PaymentSettingsCard } from "@/components/manager/PaymentSettingsCard";
import { nzCities, getSuburbsForCity } from "@/data/nzLocations";
import { useSurfaceTypes } from "@/hooks/useSurfaceTypes";

const courtSchema = z.object({
  // Court details
  name: z.string().min(2, "Name must be at least 2 characters"),
  ground_type: z.string().min(1, "Surface type is required"),
  hourly_rate: z.number().min(0),
  is_indoor: z.boolean(),
  is_active: z.boolean(),
  is_multi_court: z.boolean().default(false),
  parent_court_id: z.string().nullable().optional(),
  photo_urls: z.array(z.string()).default([]),
  description: z.string().optional(),
  rules: z.string().optional(),
  // Location details
  address: z.string().min(5, "Address must be at least 5 characters"),
  city: z.string().min(2, "City is required"),
  suburb: z.string().optional(),
  country: z.string().default("New Zealand"),
  // Payment settings
  payment_timing: z.enum(["at_booking", "before_session"]),
  payment_hours_before: z.number().min(1).max(168).default(24),
});

type CourtFormData = z.infer<typeof courtSchema>;

export default function ManagerCourtFormNew() {
  const { id } = useParams<{ id: string }>();
  const isEditing = id && id !== "new";
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(!!isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [existingVenueId, setExistingVenueId] = useState<string | null>(null);
  const [availableSuburbs, setAvailableSuburbs] = useState<string[]>([]);
  
  // Fetch other courts at the same venue (for multi-court display)
  const { data: venueCourts = [] } = useQuery({
    queryKey: ["venue-courts", existingVenueId],
    queryFn: async () => {
      if (!existingVenueId) return [];
      const { data, error } = await supabase
        .from("courts")
        .select("id, name, hourly_rate, is_active, is_multi_court, parent_court_id")
        .eq("venue_id", existingVenueId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!existingVenueId,
  });
  
  // Fetch surface types from database - NO FALLBACKS
  const { data: surfaceTypesData = [], isLoading: loadingSurfaceTypes } = useSurfaceTypes();
  
  // Build ground types from database ONLY
  const groundTypes = useMemo(() => {
    return surfaceTypesData.map(s => s.name);
  }, [surfaceTypesData]);
  
  const groundTypeLabels = useMemo(() => {
    return Object.fromEntries(surfaceTypesData.map(s => [s.name, s.display_name]));
  }, [surfaceTypesData]);

  // Get multi-court parent courts (courts that can be parents)
  const multiCourtParents = useMemo(() => {
    return venueCourts.filter(c => c.is_multi_court && c.id !== id);
  }, [venueCourts, id]);

  // Get child courts linked to current court
  const childCourts = useMemo(() => {
    if (!id) return [];
    return venueCourts.filter(c => c.parent_court_id === id);
  }, [venueCourts, id]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CourtFormData>({
    resolver: zodResolver(courtSchema),
    defaultValues: {
      hourly_rate: 50,
      is_indoor: true,
      is_active: true,
      is_multi_court: false,
      parent_court_id: null,
      ground_type: surfaceTypesData.length > 0 ? surfaceTypesData[0].name : "",
      country: "New Zealand",
      payment_timing: "at_booking",
      payment_hours_before: 24,
      photo_urls: [],
    },
  });

  const selectedCity = watch("city");
  const paymentTiming = watch("payment_timing");
  const paymentHoursBefore = watch("payment_hours_before");
  const isMultiCourt = watch("is_multi_court");
  const parentCourtId = watch("parent_court_id");

  useEffect(() => {
    if (selectedCity) {
      setAvailableSuburbs(getSuburbsForCity(selectedCity));
    } else {
      setAvailableSuburbs([]);
    }
  }, [selectedCity]);

  // Set default ground type when surface types load
  useEffect(() => {
    if (surfaceTypesData.length > 0 && !watch("ground_type")) {
      setValue("ground_type", surfaceTypesData[0].name);
    }
  }, [surfaceTypesData, setValue, watch]);

  useEffect(() => {
    if (isEditing && id) {
      fetchCourt();
    }
  }, [id, isEditing]);

  const fetchCourt = async () => {
    try {
      const { data, error } = await supabase
        .from("courts")
        .select(`
          *,
          venue:venues(id, name, address, city, suburb, country, owner_id)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      
      // Verify ownership
      if (data.venue?.owner_id !== user?.id) {
        navigate("/manager/courts");
        return;
      }

      setExistingVenueId(data.venue_id);
      
      reset({
        name: data.name,
        ground_type: (data.ground_type as any) || (surfaceTypesData.length > 0 ? surfaceTypesData[0].name : ""),
        hourly_rate: Number(data.hourly_rate),
        is_indoor: data.is_indoor ?? true,
        is_active: data.is_active ?? true,
        is_multi_court: (data as any).is_multi_court ?? false,
        parent_court_id: (data as any).parent_court_id || null,
        photo_urls: (data as any).photo_urls || (data.photo_url ? [data.photo_url] : []),
        description: "",
        rules: (data as any).rules || "",
        address: data.venue?.address || "",
        city: data.venue?.city || "",
        suburb: data.venue?.suburb || "",
        country: data.venue?.country || "New Zealand",
        payment_timing: (data.payment_timing as any) || "at_booking",
        payment_hours_before: data.payment_hours_before || 24,
      });
    } catch (error) {
      console.error("Error fetching court:", error);
      navigate("/manager/courts");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: CourtFormData) => {
    if (!user) return;
    
    setSubmitting(true);
    try {
      if (isEditing && existingVenueId) {
        // Update existing court and venue
        const { error: venueError } = await supabase
          .from("venues")
          .update({
            address: data.address,
            city: data.city,
            suburb: data.suburb || null,
            country: data.country,
          })
          .eq("id", existingVenueId);

        if (venueError) throw venueError;

        const { error: courtError } = await supabase
          .from("courts")
          .update({
            name: data.name,
            ground_type: data.ground_type as any,
            hourly_rate: data.hourly_rate,
            is_indoor: data.is_indoor,
            is_active: data.is_active,
            is_multi_court: data.is_multi_court,
            parent_court_id: data.is_multi_court ? null : (data.parent_court_id || null),
            photo_urls: data.photo_urls,
            photo_url: data.photo_urls[0] || null, // Keep backward compatibility
            payment_timing: data.payment_timing as any,
            payment_hours_before: data.payment_hours_before,
            rules: data.rules || null,
          } as any)
          .eq("id", id);

        if (courtError) throw courtError;
        toast({ title: "Court updated successfully" });
      } else {
        // Create new venue and court
        const { data: venueData, error: venueError } = await supabase
          .from("venues")
          .insert([{
            owner_id: user.id,
            name: data.name,
            address: data.address,
            city: data.city,
            suburb: data.suburb || null,
            country: data.country,
            is_active: true,
          }])
          .select()
          .single();

        if (venueError) throw venueError;

        const { error: courtError } = await supabase
          .from("courts")
          .insert([{
            venue_id: venueData.id,
            name: data.name,
            sport_type: "futsal" as any, // Default sport type since we're using ground_type now
            ground_type: data.ground_type as any,
            hourly_rate: data.hourly_rate,
            is_indoor: data.is_indoor,
            is_active: data.is_active,
            is_multi_court: data.is_multi_court,
            parent_court_id: data.is_multi_court ? null : (data.parent_court_id || null),
            photo_urls: data.photo_urls,
            photo_url: data.photo_urls[0] || null, // Keep backward compatibility
            payment_timing: data.payment_timing as any,
            payment_hours_before: data.payment_hours_before,
            rules: data.rules || null,
          } as any]);

        if (courtError) throw courtError;
        toast({ title: "Court created successfully" });
      }
      
      navigate("/manager/courts");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save court",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this court?")) {
      return;
    }

    setDeleting(true);
    try {
      // Delete court first
      const { error: courtError } = await supabase
        .from("courts")
        .delete()
        .eq("id", id);

      if (courtError) throw courtError;

      // Then delete the venue if it has no other courts
      if (existingVenueId) {
        const { count } = await supabase
          .from("courts")
          .select("*", { count: "exact", head: true })
          .eq("venue_id", existingVenueId);

        if (count === 0) {
          await supabase
            .from("venues")
            .delete()
            .eq("id", existingVenueId);
        }
      }
      
      toast({ title: "Court deleted successfully" });
      navigate("/manager/courts");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete court",
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
              {isEditing ? "Edit Court" : "Add Court"}
            </h1>
            <p className="text-muted-foreground">
              {isEditing ? "Update court details" : "Register a new sports court"}
            </p>
          </div>
        </div>

        {/* Multi-Court Info - Show when editing and venue has multiple courts */}
        {isEditing && venueCourts.length > 1 && (
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Multi-Court Venue
              </CardTitle>
              <CardDescription>
                This venue has {venueCourts.length} courts. Players can see all available courts when booking.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {venueCourts.map((court) => (
                  <Link key={court.id} to={`/manager/courts/${court.id}/edit`}>
                    <Badge 
                      variant={court.id === id ? "default" : "outline"}
                      className="cursor-pointer hover:bg-primary/10"
                    >
                      {court.name} - ${court.hourly_rate}/hr
                      {!court.is_active && " (inactive)"}
                      {court.is_multi_court && " 🏟️"}
                    </Badge>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Photo Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Court Photos</CardTitle>
            </CardHeader>
            <CardContent>
              <CourtPhotosUpload
                currentPhotoUrls={watch("photo_urls") || []}
                onPhotosChanged={(urls) => setValue("photo_urls", urls)}
                maxPhotos={4}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Court Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Court Name *</Label>
                <Input
                  id="name"
                  {...register("name")}
                  placeholder="e.g., Indoor Futsal Court 1"
                  className="mt-1"
                />
                {errors.name && (
                  <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="ground_type">Surface Type *</Label>
                {loadingSurfaceTypes ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-2 mt-1">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading surface types...
                  </div>
                ) : surfaceTypesData.length === 0 ? (
                  <p className="text-sm text-muted-foreground mt-1">
                    No surface types available. Please contact support.
                  </p>
                ) : (
                  <Select
                    value={watch("ground_type")}
                    onValueChange={(value) => setValue("ground_type", value as any)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select surface type" />
                    </SelectTrigger>
                    <SelectContent>
                      {groundTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {groundTypeLabels[type] || type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {errors.ground_type && (
                  <p className="text-sm text-destructive mt-1">{errors.ground_type.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...register("description")}
                  placeholder="Tell players about your court..."
                  rows={3}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="rules">Court Rules & Guidelines</Label>
                <Textarea
                  id="rules"
                  {...register("rules")}
                  placeholder="Enter any rules, restrictions, or guidelines for players booking this court (e.g., no metal studs, no food/drinks on court, arrive 10 min early)..."
                  rows={4}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  These rules will be shown to players before they confirm their booking
                </p>
              </div>

              <div>
                <Label htmlFor="hourly_rate">Hourly Rate (NZD) *</Label>
                <Input
                  id="hourly_rate"
                  type="number"
                  step="0.01"
                  {...register("hourly_rate", { valueAsNumber: true })}
                  className="mt-1"
                />
                {errors.hourly_rate && (
                  <p className="text-sm text-destructive mt-1">{errors.hourly_rate.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Multi-Court Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                Multi-Court Configuration
              </CardTitle>
              <CardDescription>
                Configure this court as part of a multi-court venue
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="is_multi_court">Is Multi-Court Parent</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable if this court groups multiple sub-courts together
                  </p>
                </div>
                <Switch
                  id="is_multi_court"
                  checked={isMultiCourt}
                  onCheckedChange={(checked) => {
                    setValue("is_multi_court", checked);
                    if (checked) {
                      setValue("parent_court_id", null);
                    }
                  }}
                />
              </div>

              {/* Show parent selector only if NOT a multi-court parent and there are multi-court parents */}
              {!isMultiCourt && multiCourtParents.length > 0 && (
                <div>
                  <Label htmlFor="parent_court_id">Link to Parent Court (Optional)</Label>
                  <Select
                    value={parentCourtId || "none"}
                    onValueChange={(value) => setValue("parent_court_id", value === "none" ? null : value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select parent court" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No parent (standalone court)</SelectItem>
                      {multiCourtParents.map((court) => (
                        <SelectItem key={court.id} value={court.id}>
                          {court.name} (Multi-Court)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Link this court to a multi-court parent to group them together
                  </p>
                </div>
              )}

              {/* Show linked child courts if this is a multi-court parent */}
              {isMultiCourt && childCourts.length > 0 && (
                <div className="pt-2">
                  <Label>Linked Sub-Courts</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {childCourts.map((court) => (
                      <Link key={court.id} to={`/manager/courts/${court.id}/edit`}>
                        <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                          {court.name}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {isMultiCourt && childCourts.length === 0 && isEditing && (
                <p className="text-sm text-muted-foreground">
                  No sub-courts linked yet. Create additional courts and link them to this multi-court.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="country">Country</Label>
                <Select
                  value={watch("country")}
                  onValueChange={(value) => setValue("country", value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="New Zealand">New Zealand</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="city">City *</Label>
                <Select
                  value={watch("city")}
                  onValueChange={(value) => {
                    setValue("city", value);
                    setValue("suburb", ""); // Reset suburb when city changes
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select city" />
                  </SelectTrigger>
                  <SelectContent>
                    {nzCities.map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.city && (
                  <p className="text-sm text-destructive mt-1">{errors.city.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="suburb">Suburb</Label>
                <Select
                  value={watch("suburb") || ""}
                  onValueChange={(value) => setValue("suburb", value)}
                  disabled={!selectedCity || availableSuburbs.length === 0}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={selectedCity ? "Select suburb" : "Select a city first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSuburbs.map((suburb) => (
                      <SelectItem key={suburb} value={suburb}>
                        {suburb}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="address">Street Address *</Label>
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
            </CardContent>
          </Card>

          {/* Payment Settings */}
          <PaymentSettingsCard
            paymentTiming={paymentTiming}
            paymentHoursBefore={paymentHoursBefore}
            onPaymentTimingChange={(timing) => setValue("payment_timing", timing)}
            onPaymentHoursChange={(hours) => setValue("payment_hours_before", hours)}
          />

          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="is_indoor">Indoor Court</Label>
                  <p className="text-sm text-muted-foreground">
                    Is this an indoor facility?
                  </p>
                </div>
                <Switch
                  id="is_indoor"
                  checked={watch("is_indoor")}
                  onCheckedChange={(checked) => setValue("is_indoor", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="is_active">Active</Label>
                  <p className="text-sm text-muted-foreground">
                    Inactive courts won't be available for booking
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
                isEditing ? "Update Court" : "Create Court"
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
