import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { ArrowLeft, Loader2, Trash2, Building2, Plus, Link as LinkIcon, DollarSign } from "lucide-react";
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

interface VenueCourt {
  id: string;
  name: string;
  hourly_rate: number;
  is_active: boolean | null;
  is_multi_court: boolean | null;
  parent_court_id: string | null;
  ground_type: string | null;
  photo_urls: string[] | null;
  photo_url: string | null;
  rules: string | null;
}

export default function ManagerCourtFormNew() {
  const { id } = useParams<{ id: string }>();
  const isEditing = id && id !== "new";
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [loading, setLoading] = useState(!!isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [existingVenueId, setExistingVenueId] = useState<string | null>(null);
  const [availableSuburbs, setAvailableSuburbs] = useState<string[]>([]);
  const [venueName, setVenueName] = useState<string>("");
  
  // Multi-court tab state
  const [selectedTabCourtId, setSelectedTabCourtId] = useState<string | null>(null);
  
  // Fetch other courts at the same venue (for multi-court display)
  const { data: venueCourts = [], refetch: refetchCourts } = useQuery({
    queryKey: ["venue-courts", existingVenueId],
    queryFn: async () => {
      if (!existingVenueId) return [];
      const { data, error } = await supabase
        .from("courts")
        .select("id, name, hourly_rate, is_active, is_multi_court, parent_court_id, ground_type, photo_urls, photo_url, rules")
        .eq("venue_id", existingVenueId)
        .order("name");
      if (error) throw error;
      return (data || []) as VenueCourt[];
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
  const currentCourt = venueCourts.find(c => c.id === id);
  const isMultiCourtParent = currentCourt?.is_multi_court || false;
  
  // Get child courts linked to current court (only if this is a parent)
  const childCourts = useMemo(() => {
    if (!id || !isMultiCourtParent) return [];
    return venueCourts.filter(c => c.parent_court_id === id);
  }, [venueCourts, id, isMultiCourtParent]);

  // All courts to show in tabs: parent + children
  const tabCourts = useMemo(() => {
    if (!isMultiCourtParent) return [];
    const parent = venueCourts.find(c => c.id === id);
    return parent ? [parent, ...childCourts] : [];
  }, [venueCourts, id, isMultiCourtParent, childCourts]);

  // Get selected tab court details
  const selectedTabCourt = useMemo(() => {
    if (!selectedTabCourtId) return null;
    return venueCourts.find(c => c.id === selectedTabCourtId) || null;
  }, [venueCourts, selectedTabCourtId]);

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

  // When editing a multi-court parent, set the selected tab to the current court
  useEffect(() => {
    if (isEditing && id && isMultiCourtParent) {
      setSelectedTabCourtId(id);
    }
  }, [isEditing, id, isMultiCourtParent]);

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
      setVenueName(data.venue?.name || "");
      
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

  // Load selected tab court data into form
  const loadCourtIntoForm = async (courtId: string) => {
    if (courtId === id) {
      // Just reload current court data
      await fetchCourt();
      return;
    }
    
    // Navigate to the selected court's edit page
    navigate(`/manager/courts/${courtId}/edit`);
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
            parent_court_id: data.is_multi_court ? null : null, // Parents don't have parent_court_id
            photo_urls: data.photo_urls,
            photo_url: data.photo_urls[0] || null, // Keep backward compatibility
            payment_timing: data.payment_timing as any,
            payment_hours_before: data.payment_hours_before,
            rules: data.rules || null,
          } as any)
          .eq("id", id);

        if (courtError) throw courtError;
        
        // Refresh courts list
        await refetchCourts();
        
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
            parent_court_id: null,
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

  const handleAddSubCourt = async () => {
    if (!existingVenueId || !user || !id) return;
    
    try {
      const { data: newCourt, error } = await supabase
        .from("courts")
        .insert([{
          venue_id: existingVenueId,
          name: `Sub-Court ${childCourts.length + 1}`,
          sport_type: "futsal" as any,
          ground_type: surfaceTypesData.length > 0 ? surfaceTypesData[0].name as any : "turf" as any,
          hourly_rate: currentCourt?.hourly_rate || 50,
          is_indoor: true,
          is_active: true,
          is_multi_court: false,
          parent_court_id: id, // Link to current parent
        } as any])
        .select()
        .single();
      
      if (error) throw error;
      
      await refetchCourts();
      toast({ title: "Sub-court created", description: "Click on the tab to edit it." });
      setSelectedTabCourtId(newCourt.id);
    } catch (err: any) {
      toast({ 
        title: "Error creating sub-court", 
        description: err.message,
        variant: "destructive" 
      });
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
      <div className="p-4 md:p-6 space-y-6">
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

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column - Form */}
          <div className="space-y-6">
            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Photo Upload */}
              <Card className="bg-[#111a27]/60 border-[#00f2ea]/10">
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

              <Card className="bg-[#111a27]/60 border-[#00f2ea]/10">
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
                      className="mt-1 bg-[#0a0f18] border-[#00f2ea]/20"
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
                        <SelectTrigger className="mt-1 bg-[#0a0f18] border-[#00f2ea]/20">
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
                      className="mt-1 bg-[#0a0f18] border-[#00f2ea]/20"
                    />
                  </div>

                  <div>
                    <Label htmlFor="rules">Court Rules & Guidelines</Label>
                    <Textarea
                      id="rules"
                      {...register("rules")}
                      placeholder="Enter any rules, restrictions, or guidelines for players booking this court..."
                      rows={4}
                      className="mt-1 bg-[#0a0f18] border-[#00f2ea]/20"
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
                      className="mt-1 bg-[#0a0f18] border-[#00f2ea]/20"
                    />
                    {errors.hourly_rate && (
                      <p className="text-sm text-destructive mt-1">{errors.hourly_rate.message}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#111a27]/60 border-[#00f2ea]/10">
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
                      <SelectTrigger className="mt-1 bg-[#0a0f18] border-[#00f2ea]/20">
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
                      <SelectTrigger className="mt-1 bg-[#0a0f18] border-[#00f2ea]/20">
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
                      <SelectTrigger className="mt-1 bg-[#0a0f18] border-[#00f2ea]/20">
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
                      className="mt-1 bg-[#0a0f18] border-[#00f2ea]/20"
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

              <Card className="bg-[#111a27]/60 border-[#00f2ea]/10">
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
                <Button type="submit" disabled={submitting} className="flex-1 bg-[#00f2ea] text-black hover:bg-[#00f2ea]/80">
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

          {/* Right Column - Court Info Header + Multi-Court Configuration */}
          <div className="space-y-6">
            {/* Court Details Header - Always visible when editing */}
            {isEditing && venueName && (
              <Card className="bg-[#111a27]/60 border-[#00f2ea]/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-400">Court Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <h2 className="text-xl font-bold text-white">{venueName}</h2>
                  <p className="text-gray-500 text-sm mt-1">Main Court Parent</p>
                </CardContent>
              </Card>
            )}

            {/* Multi-Court Configuration - Always visible when editing */}
            {isEditing && (
              <Card className="bg-[#111a27]/60 border-[#00f2ea]/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LinkIcon className="h-5 w-5 text-[#00f2ea]" />
                    Multi-Court Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Is Multi-Court Toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="is_multi_court">Is Multi-Court Parent</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable to add sub-courts to this venue
                      </p>
                    </div>
                    <Switch
                      id="is_multi_court"
                      checked={isMultiCourt}
                      onCheckedChange={(checked) => {
                        setValue("is_multi_court", checked);
                      }}
                      className="data-[state=checked]:bg-[#00f2ea]"
                    />
                  </div>

                  {/* Tabs for courts - Only show when Multi-Court is enabled */}
                  {isMultiCourt && (
                    <div className="space-y-4 pt-4 border-t border-[#00f2ea]/10">
                      {/* Court Tabs */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {tabCourts.map((court, index) => (
                          <button
                            key={court.id}
                            type="button"
                            onClick={() => {
                              setSelectedTabCourtId(court.id);
                              if (court.id !== id) {
                                loadCourtIntoForm(court.id);
                              }
                            }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              (selectedTabCourtId || id) === court.id
                                ? 'bg-[#00f2ea]/20 text-[#00f2ea] border-b-2 border-[#00f2ea]'
                                : 'bg-[#0a0f18] text-gray-400 hover:text-white'
                            }`}
                          >
                            {index === 0 ? 'Main Court' : court.name}
                          </button>
                        ))}
                        
                        {/* Add Sub-Court Button */}
                        <Button
                          type="button"
                          onClick={handleAddSubCourt}
                          variant="outline"
                          size="sm"
                          className="border-[#00f2ea] text-[#00f2ea] hover:bg-[#00f2ea]/10 gap-1"
                        >
                          <Plus className="h-4 w-4" />
                          Add Sub-Court
                        </Button>
                      </div>

                      {/* Selected Court Preview */}
                      {selectedTabCourt && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Court Photo Preview */}
                          <div className="rounded-xl overflow-hidden aspect-video bg-[#0a0f18]">
                            {(selectedTabCourt.photo_urls?.[0] || selectedTabCourt.photo_url) ? (
                              <img 
                                src={selectedTabCourt.photo_urls?.[0] || selectedTabCourt.photo_url || ""} 
                                alt={selectedTabCourt.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-600">
                                <Building2 className="h-12 w-12" />
                              </div>
                            )}
                          </div>

                          {/* Court Details */}
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Sub-Court Name</p>
                              <p className="text-[#00f2ea] font-bold text-lg">
                                {selectedTabCourt.name} - {groundTypeLabels[selectedTabCourt.ground_type || ""] || selectedTabCourt.ground_type || "Unknown"}
                              </p>
                              <p className="text-gray-500 text-xs mt-1 line-clamp-2">
                                {selectedTabCourt.rules || "No rules set for this court."}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Surface Type</p>
                              <Select
                                value={selectedTabCourt.ground_type || ""}
                                disabled
                              >
                                <SelectTrigger className="mt-1 bg-[#0a0f18] border-[#00f2ea]/20">
                                  <SelectValue placeholder="Surface type" />
                                </SelectTrigger>
                                <SelectContent>
                                  {groundTypes.map((type) => (
                                    <SelectItem key={type} value={type}>
                                      {groundTypeLabels[type] || type}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="flex justify-between items-center">
                              <div>
                                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Hourly Rate</p>
                              </div>
                              <p className="text-white font-bold">
                                {selectedTabCourt.hourly_rate} NZD
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Main Court Preview - when parent itself is selected */}
                      {(!selectedTabCourtId || selectedTabCourtId === id) && currentCourt && (
                        <div className="rounded-xl overflow-hidden">
                          <div className="aspect-video bg-[#0a0f18] relative">
                            {(watch("photo_urls")?.[0]) ? (
                              <img 
                                src={watch("photo_urls")?.[0]} 
                                alt={watch("name")}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-600">
                                <Building2 className="h-12 w-12" />
                              </div>
                            )}
                          </div>
                          <div className="p-3 bg-[#0a0f18]/80">
                            <p className="text-[#00f2ea] font-bold">
                              {watch("name") || "Main Court"} - {groundTypeLabels[watch("ground_type")] || watch("ground_type") || "Surface"}
                            </p>
                            <p className="text-gray-500 text-xs mt-1 line-clamp-2">
                              {watch("rules") || "Court rules will appear here once added."}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Empty state when no courts yet */}
                      {tabCourts.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <p>Enable the toggle above to start adding sub-courts.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Show linked child courts summary if not multi-court but has children somehow */}
                  {!isMultiCourt && childCourts.length > 0 && (
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
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </ManagerLayout>
  );
}
