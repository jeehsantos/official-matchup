import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
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
import {
  ArrowLeft, Loader2, Trash2, Building2, Plus, Link as LinkIcon,
  DollarSign, Check, Camera, MapPin, ShieldAlert, Edit3, Image as ImageIcon, Box,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { CourtPhotosUpload } from "@/components/manager/CourtPhotosUpload";
import { VenueDetailsEditor } from "@/components/manager/VenueDetailsEditor";
import { AllowedSportsSelector } from "@/components/manager/AllowedSportsSelector";
import { StripeSetupAlert } from "@/components/manager/StripeSetupAlert";
import { useManagerStripeReady } from "@/hooks/useStripeConnectStatus";
import { nzCities, getSuburbsForCity } from "@/data/nzLocations";
import { useSurfaceTypes } from "@/hooks/useSurfaceTypes";

const courtSchema = z.object({
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
  address: z.string().min(5, "Address must be at least 5 characters"),
  city: z.string().min(2, "City is required"),
  suburb: z.string().optional(),
  country: z.string().default("New Zealand"),
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
  is_indoor: boolean | null;
  payment_timing: string | null;
  payment_hours_before: number | null;
}

export default function ManagerCourtFormNew() {
  const { t } = useTranslation("manager");
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
  const [venueData, setVenueData] = useState<any>(null);
  const [venueAllowedSports, setVenueAllowedSports] = useState<string[]>([]);
  const [venueAmenities, setVenueAmenities] = useState<string[]>([]);
  const { data: stripeStatus, isLoading: stripeLoading } = useManagerStripeReady();

  // Multi-court state — selectedTabCourtId is the single source of truth for which court is being edited
  const [selectedTabCourtId, setSelectedTabCourtId] = useState<string | null>(null);
  const [isAddingNewSubCourt, setIsAddingNewSubCourt] = useState(false);

  // The route-level court ID (the one from URL)
  const routeCourtId = isEditing ? id : null;

  // Fetch other courts at the same venue
  const { data: venueCourts = [], refetch: refetchCourts } = useQuery({
    queryKey: ["venue-courts", existingVenueId],
    queryFn: async () => {
      if (!existingVenueId) return [];
      const { data, error } = await supabase
        .from("courts")
        .select("id, name, hourly_rate, is_active, is_multi_court, parent_court_id, ground_type, photo_urls, photo_url, rules, is_indoor, payment_timing, payment_hours_before")
        .eq("venue_id", existingVenueId)
        .order("name");
      if (error) throw error;
      return (data || []) as VenueCourt[];
    },
    enabled: !!existingVenueId,
  });

  const { data: surfaceTypesData = [], isLoading: loadingSurfaceTypes } = useSurfaceTypes();

  const groundTypes = useMemo(() => {
    return surfaceTypesData.map(s => s.name);
  }, [surfaceTypesData]);

  const groundTypeLabels = useMemo(() => {
    return Object.fromEntries(surfaceTypesData.map(s => [s.name, s.display_name]));
  }, [surfaceTypesData]);

  // Determine the active court from selectedTabCourtId (falls back to route id)
  const activeCourtId = selectedTabCourtId || routeCourtId || null;
  const activeCourt = venueCourts.find(c => c.id === activeCourtId) || null;

  // Determine the effective parent: the root court of the multi-court family
  const effectiveParentId = useMemo(() => {
    if (!activeCourt) return routeCourtId || null;
    if (activeCourt.is_multi_court) return activeCourt.id;
    if (activeCourt.parent_court_id) return activeCourt.parent_court_id;
    return activeCourt.id;
  }, [activeCourt, routeCourtId]);

  const parentCourt = venueCourts.find(c => c.id === effectiveParentId) || null;

  // Derive child courts from actual parent_court_id relationships
  const childCourts = useMemo(() => {
    if (!effectiveParentId) return [];
    return venueCourts.filter(c => c.parent_court_id === effectiveParentId);
  }, [venueCourts, effectiveParentId]);

  // Show multi-court config when parent has is_multi_court OR children actually exist
  const hasChildren = childCourts.length > 0;
  const showMultiCourtConfig = hasChildren || (parentCourt?.is_multi_court ?? false);

  const tabCourts = useMemo(() => {
    if (!effectiveParentId) return [];
    const parent = venueCourts.find(c => c.id === effectiveParentId);
    return parent ? [parent, ...childCourts] : [];
  }, [venueCourts, effectiveParentId, childCourts]);

  // Whether the currently active tab is the parent court
  const isActiveTabParent = activeCourtId === effectiveParentId;

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
  const watchedName = watch("name");
  const watchedRate = watch("hourly_rate");
  const watchedGroundType = watch("ground_type");
  const watchedPhotoUrls = watch("photo_urls");

  useEffect(() => {
    if (selectedCity) {
      setAvailableSuburbs(getSuburbsForCity(selectedCity));
    } else {
      setAvailableSuburbs([]);
    }
  }, [selectedCity]);

  useEffect(() => {
    if (surfaceTypesData.length > 0 && !watch("ground_type")) {
      setValue("ground_type", surfaceTypesData[0].name);
    }
  }, [surfaceTypesData, setValue, watch]);

  useEffect(() => {
    if (isEditing && id) {
      fetchCourt(id);
    }
  }, [id, isEditing]);

  useEffect(() => {
    if (isEditing && id) {
      setSelectedTabCourtId(id);
      setIsAddingNewSubCourt(false);
    }
  }, [isEditing, id]);

  const fetchCourt = async (courtId: string) => {
    try {
      const { data, error } = await supabase
        .from("courts")
        .select(`
          *,
          venue:venues(id, name, address, city, suburb, country, owner_id, amenities)
        `)
        .eq("id", courtId)
        .single();

      if (error) throw error;

      if (data.venue?.owner_id !== user?.id) {
        navigate("/manager/courts");
        return;
      }

      setExistingVenueId(data.venue_id);
      setVenueName(data.venue?.name || "");
      setVenueData(data.venue);
      setVenueAllowedSports((data as any).allowed_sports || []);
      setVenueAmenities(data.venue?.amenities || []);

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

  const loadCourtDataIntoForm = (court: VenueCourt) => {
    setIsAddingNewSubCourt(false);
    setSelectedTabCourtId(court.id);
    // No window.history.replaceState — we keep the original route stable

    reset({
      name: court.name,
      ground_type: court.ground_type || (surfaceTypesData.length > 0 ? surfaceTypesData[0].name : ""),
      hourly_rate: Number(court.hourly_rate),
      is_indoor: court.is_indoor ?? true,
      is_active: court.is_active ?? true,
      is_multi_court: court.is_multi_court ?? false,
      parent_court_id: court.parent_court_id || null,
      photo_urls: court.photo_urls || (court.photo_url ? [court.photo_url] : []),
      description: "",
      rules: court.rules || "",
      address: venueData?.address || "",
      city: venueData?.city || "",
      suburb: venueData?.suburb || "",
      country: venueData?.country || "New Zealand",
      payment_timing: (court.payment_timing as any) || "at_booking",
      payment_hours_before: court.payment_hours_before || 24,
    });
  };

  const [newSubCourtPhotos, setNewSubCourtPhotos] = useState<string[]>([]);

  const handleAddSubCourt = () => {
    setIsAddingNewSubCourt(true);
    setSelectedTabCourtId(null);
    setNewSubCourtPhotos([]);

    reset({
      name: `Sub-Court ${childCourts.length + 1}`,
      ground_type: surfaceTypesData.length > 0 ? surfaceTypesData[0].name : "",
      hourly_rate: parentCourt ? Number(parentCourt.hourly_rate) : 50,
      is_indoor: true,
      is_active: true,
      is_multi_court: false,
      parent_court_id: effectiveParentId,
      photo_urls: [],
      description: "",
      rules: "",
      address: venueData?.address || "",
      city: venueData?.city || "",
      suburb: venueData?.suburb || "",
      country: venueData?.country || "New Zealand",
      payment_timing: "at_booking",
      payment_hours_before: 24,
    });

    toast({
      title: t("courtForm.addCourt"),
      description: t("courtForm.addNewCourt")
    });
  };

  const onSubmit = async (data: CourtFormData) => {
    if (!user) return;

    setSubmitting(true);
    try {
      if (isAddingNewSubCourt && existingVenueId && effectiveParentId) {
        // Insert sub-court — DB trigger will auto-promote parent's is_multi_court
        const { data: newCourt, error: courtError } = await supabase
          .from("courts")
          .insert([{
            venue_id: existingVenueId,
            name: data.name,
            ground_type: data.ground_type as any,
            hourly_rate: data.hourly_rate,
            is_indoor: data.is_indoor,
            is_active: data.is_active,
            is_multi_court: false,
            parent_court_id: effectiveParentId,
            photo_urls: data.photo_urls,
            photo_url: data.photo_urls[0] || null,
            payment_timing: data.payment_timing as any,
            payment_hours_before: data.payment_hours_before,
            rules: data.rules || null,
            allowed_sports: venueAllowedSports,
          } as any])
          .select()
          .single();

        if (courtError) throw courtError;
        await refetchCourts();
        setIsAddingNewSubCourt(false);
        setSelectedTabCourtId(newCourt.id);
        // Load the newly created court into the form
        toast({ title: t("courtForm.subCourtCreated") });
        return;
      }

      if (isEditing && existingVenueId) {
        const { error: venueError } = await supabase
          .from("venues")
          .update({
            name: venueName,
            address: data.address,
            city: data.city,
            suburb: data.suburb || null,
            country: data.country,
            amenities: venueAmenities,
          } as any)
          .eq("id", existingVenueId);

        if (venueError) throw venueError;

        // Use activeCourtId (selectedTab or route) — never just route id
        const courtIdToUpdate = activeCourtId;

        const { error: courtError } = await supabase
          .from("courts")
          .update({
            name: data.name,
            ground_type: data.ground_type as any,
            hourly_rate: data.hourly_rate,
            is_indoor: data.is_indoor,
            is_active: data.is_active,
            is_multi_court: data.is_multi_court,
            parent_court_id: data.parent_court_id || null,
            photo_urls: data.photo_urls,
            photo_url: data.photo_urls[0] || null,
            payment_timing: data.payment_timing as any,
            payment_hours_before: data.payment_hours_before,
            rules: data.rules || null,
            allowed_sports: venueAllowedSports,
          } as any)
          .eq("id", courtIdToUpdate);

        if (courtError) throw courtError;
        await refetchCourts();
        toast({ title: t("courtForm.courtUpdated") });
      } else {
        const { data: newVenueData, error: venueError } = await supabase
          .from("venues")
          .insert([{
            owner_id: user.id,
            name: data.name,
            address: data.address,
            city: data.city,
            suburb: data.suburb || null,
            country: data.country,
            is_active: true,
            amenities: venueAmenities,
          } as any])
          .select()
          .single();

        if (venueError) throw venueError;

        const { error: courtError } = await supabase
          .from("courts")
          .insert([{
            venue_id: newVenueData.id,
            name: data.name,
            ground_type: data.ground_type as any,
            hourly_rate: data.hourly_rate,
            is_indoor: data.is_indoor,
            is_active: data.is_active,
            is_multi_court: data.is_multi_court,
            parent_court_id: null,
            photo_urls: data.photo_urls,
            photo_url: data.photo_urls[0] || null,
            payment_timing: data.payment_timing as any,
            payment_hours_before: data.payment_hours_before,
            rules: data.rules || null,
            allowed_sports: venueAllowedSports,
          } as any]);

        if (courtError) throw courtError;
        toast({ title: t("courtForm.courtCreated") });
        navigate("/manager/courts");
      }
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
    const courtIdToDelete = activeCourtId;
    if (!courtIdToDelete) return;
    if (!confirm("Are you sure you want to delete this court?")) return;

    setDeleting(true);
    try {
      const { error: courtError } = await supabase
        .from("courts")
        .delete()
        .eq("id", courtIdToDelete);

      if (courtError) throw courtError;

      // If deleting a sub-court, go back to parent
      if (courtIdToDelete !== routeCourtId && parentCourt) {
        await refetchCourts();
        setSelectedTabCourtId(parentCourt.id);
        loadCourtDataIntoForm(parentCourt);
        toast({ title: t("courtForm.subCourtDeleted") });
        return;
      }

      if (existingVenueId) {
        const { count } = await supabase
          .from("courts")
          .select("*", { count: "exact", head: true })
          .eq("venue_id", existingVenueId);

        if (count === 0) {
          await supabase.from("venues").delete().eq("id", existingVenueId);
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

  // Handle multi-court toggle with safeguard
  const handleMultiCourtToggle = (checked: boolean) => {
    if (!checked && hasChildren) {
      toast({
        title: "Cannot disable multi-court",
        description: "Delete all sub-courts first before disabling multi-court.",
        variant: "destructive",
      });
      return;
    }
    setValue("is_multi_court", checked);
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

  // Preview court data for right panel
  const previewName = watchedName || "Unnamed Court";
  const previewRate = watchedRate || 0;
  const previewSurface = groundTypeLabels[watchedGroundType] || watchedGroundType || "-";
  const previewPhoto = watchedPhotoUrls?.[0] || null;

  // Determine label for active court
  const activeIsSubCourt = isAddingNewSubCourt || (activeCourt?.parent_court_id != null);

  return (
    <ManagerLayout>
      {/* Sticky Header - outside padded container */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border shadow-sm px-4 md:px-6 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-bold">
                {isAddingNewSubCourt ? t("courtForm.addCourt") : isEditing ? t("courtForm.editCourt") : t("courtForm.addCourt")}
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm">
                {isAddingNewSubCourt ? t("courtForm.addNewCourt") : isEditing ? t("courtForm.updateCourtDetails") : t("courtForm.addNewCourt")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 ml-auto sm:ml-0">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit(onSubmit)}
              disabled={submitting || (!isEditing && !stripeStatus?.isReady)}
              className="gap-2"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {isAddingNewSubCourt ? t("courtForm.createCourt") : isEditing ? t("courtForm.updateCourt") : t("courtForm.createCourt")}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-6">

        {/* Stripe Setup Warning for new courts */}
        {!isEditing && !stripeLoading && !stripeStatus?.isReady && (
          <StripeSetupAlert hasVenues={stripeStatus?.hasVenues ?? false} />
        )}

        {/* Mobile: Preview Panel at top */}
        <div className="lg:hidden">
          <MobilePreviewPanel
            isEditing={!!isEditing}
            isMultiCourt={isMultiCourt}
            showMultiCourtConfig={showMultiCourtConfig}
            hasChildren={hasChildren}
            tabCourts={tabCourts}
            selectedTabCourtId={selectedTabCourtId}
            isAddingNewSubCourt={isAddingNewSubCourt}
            effectiveParentId={effectiveParentId}
            activeCourt={activeCourt}
            parentCourt={parentCourt}
            isActiveTabParent={isActiveTabParent}
            previewName={previewName}
            previewRate={previewRate}
            previewSurface={previewSurface}
            previewPhoto={previewPhoto}
            groundTypeLabels={groundTypeLabels}
            onTabClick={loadCourtDataIntoForm}
            onAddSubCourt={handleAddSubCourt}
            onToggleMultiCourt={handleMultiCourtToggle}
            venueName={venueName}
            onVenueNameChange={setVenueName}
          />
        </div>

        {/* Two Column Layout */}
        <div className="flex gap-8 items-start max-w-[1600px] mx-auto w-full">
          {/* Left Column - Form Cards */}
          <form onSubmit={handleSubmit(onSubmit)} className="flex-1 space-y-6 min-w-0">
            {/* 1. Basic Details Card */}
            <Card className="rounded-2xl border border-border shadow-sm">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Edit3 className="h-5 w-5 text-primary" />
                  {t("courtForm.courtDetails")}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Court Name - Full width */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="name">{t("courtForm.courtName")}</Label>
                    <Input
                      id="name"
                      {...register("name")}
                      placeholder="e.g., Indoor Futsal Court 1"
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name.message}</p>
                    )}
                  </div>

                  {/* Surface Type */}
                  <div className="space-y-1.5">
                    <Label>Surface Type *</Label>
                    {loadingSurfaceTypes ? (
                      <div className="flex items-center gap-2 text-muted-foreground py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading...
                      </div>
                    ) : (
                      <Select
                        value={watch("ground_type")}
                        onValueChange={(value) => setValue("ground_type", value as any)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select surface..." />
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
                      <p className="text-sm text-destructive">{errors.ground_type.message}</p>
                    )}
                  </div>

                  {/* Hourly Rate */}
                  <div className="space-y-1.5">
                    <Label htmlFor="hourly_rate">{t("courtForm.hourlyRate")}</Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <Input
                        id="hourly_rate"
                        type="number"
                        step="0.01"
                        {...register("hourly_rate", { valueAsNumber: true })}
                        className="pl-9"
                        placeholder="0.00"
                      />
                    </div>
                    {errors.hourly_rate && (
                      <p className="text-sm text-destructive">{errors.hourly_rate.message}</p>
                    )}
                  </div>

                  {/* Allowed Sports - Full width */}
                  <div className="sm:col-span-2">
                    <AllowedSportsSelector
                      allowedSports={venueAllowedSports}
                      onAllowedSportsChange={setVenueAllowedSports}
                    />
                  </div>

                  {/* Description - Full width */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      {...register("description")}
                      placeholder="Tell players about your court..."
                      rows={3}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 3. Location Card */}
            <Card className="rounded-2xl border border-border shadow-sm">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Location
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <Label>Country</Label>
                    <Select
                      value={watch("country")}
                      onValueChange={(value) => setValue("country", value)}
                      disabled
                    >
                      <SelectTrigger className="bg-muted/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="New Zealand">New Zealand</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>City *</Label>
                    <Select
                      value={watch("city")}
                      onValueChange={(value) => {
                        setValue("city", value);
                        setValue("suburb", "");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select city..." />
                      </SelectTrigger>
                      <SelectContent>
                        {nzCities.map((city) => (
                          <SelectItem key={city} value={city}>{city}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.city && (
                      <p className="text-sm text-destructive">{errors.city.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label>Suburb</Label>
                    <Select
                      value={watch("suburb") || ""}
                      onValueChange={(value) => setValue("suburb", value)}
                      disabled={!selectedCity || availableSuburbs.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={selectedCity ? "Select suburb..." : "Select a city first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSuburbs.map((suburb) => (
                          <SelectItem key={suburb} value={suburb}>{suburb}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="address">Street Address *</Label>
                    <Input
                      id="address"
                      {...register("address")}
                      placeholder="e.g., 123 Sports Lane"
                    />
                    {errors.address && (
                      <p className="text-sm text-destructive">{errors.address.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 4. Venue Facilities - Only for parent courts */}
            {(!activeIsSubCourt) && (
              <VenueDetailsEditor
                amenities={venueAmenities}
                onAmenitiesChange={setVenueAmenities}
              />
            )}

            {/* 5. Policies & Settings Card */}
            <Card className="rounded-2xl border border-border shadow-sm">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                  Policies & Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-6">
                {/* Court Rules */}
                <div className="space-y-1.5">
                  <Label htmlFor="rules">Court Rules & Guidelines</Label>
                  <Textarea
                    id="rules"
                    {...register("rules")}
                    placeholder="- Non-marking shoes only&#10;- No food or drinks on court&#10;- Respect booking times"
                    rows={4}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    These rules will be shown to players before they confirm their booking.
                  </p>
                </div>

                {/* Payment Settings - Card style buttons */}
                <div className="space-y-3">
                  <Label>{t("payment.title")}</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setValue("payment_timing", "at_booking")}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        paymentTiming === "at_booking"
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      <div className="font-semibold text-foreground mb-1 flex items-center justify-between">
                        {t("payment.atBooking")}
                        {paymentTiming === "at_booking" && <Check className="h-4 w-4 text-primary" />}
                      </div>
                      <div className="text-xs text-muted-foreground">{t("payment.atBookingDesc")}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setValue("payment_timing", "before_session")}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        paymentTiming === "before_session"
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      <div className="font-semibold text-foreground mb-1 flex items-center justify-between">
                        {t("payment.beforeSession")}
                        {paymentTiming === "before_session" && <Check className="h-4 w-4 text-primary" />}
                      </div>
                      <div className="text-xs text-muted-foreground">{t("payment.beforeSessionDesc")}</div>
                    </button>
                  </div>

                  {paymentTiming === "before_session" && (
                    <div className="p-4 rounded-lg bg-muted/50 border border-border flex flex-col sm:flex-row sm:items-center gap-4 animate-in fade-in slide-in-from-top-2">
                      <div className="space-y-1 flex-1">
                        <Label htmlFor="payment_hours_before" className="text-sm font-medium">{t("payment.hoursBefore")}</Label>
                        <p className="text-xs text-muted-foreground">{t("payment.hoursBeforeDesc")}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          id="payment_hours_before"
                          type="number"
                          min={1}
                          max={168}
                          value={paymentHoursBefore}
                          onChange={(e) => setValue("payment_hours_before", parseInt(e.target.value) || 24)}
                          className="w-20 text-center"
                        />
                        <span className="text-sm text-muted-foreground font-medium">hours</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Toggle switches */}
                <div className="pt-4 border-t border-border space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="is_indoor" className="text-sm font-medium">Indoor Court</Label>
                      <p className="text-xs text-muted-foreground">Is this an indoor facility?</p>
                    </div>
                    <Switch
                      id="is_indoor"
                      checked={watch("is_indoor")}
                      onCheckedChange={(checked) => setValue("is_indoor", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="is_active" className="text-sm font-medium">Active</Label>
                      <p className="text-xs text-muted-foreground">Inactive courts won't be available for booking.</p>
                    </div>
                    <Switch
                      id="is_active"
                      checked={watch("is_active")}
                      onCheckedChange={(checked) => setValue("is_active", checked)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 6. Court Photos Card */}
            <Card className="rounded-2xl border border-border shadow-sm">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Camera className="h-5 w-5 text-primary" />
                    {t("courtForm.courtPhotos") || "Court Photos"}
                  </CardTitle>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">Max 4 photos (JPG, PNG)</span>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <CourtPhotosUpload
                  key={isAddingNewSubCourt ? 'new-sub-court' : activeCourtId || id}
                  currentPhotoUrls={isAddingNewSubCourt ? newSubCourtPhotos : (watch("photo_urls") || [])}
                  onPhotosChanged={(urls) => {
                    if (isAddingNewSubCourt) {
                      setNewSubCourtPhotos(urls);
                    }
                    setValue("photo_urls", urls);
                  }}
                  maxPhotos={4}
                />
              </CardContent>
            </Card>

            {(isEditing || isAddingNewSubCourt) && (
              <div className="lg:hidden">
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  onClick={isAddingNewSubCourt ? () => {
                    setIsAddingNewSubCourt(false);
                    if (parentCourt) loadCourtDataIntoForm(parentCourt);
                  } : handleDelete}
                  disabled={deleting}
                >
                  {isAddingNewSubCourt ? "Cancel" : deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Court
                    </>
                  )}
                </Button>
              </div>
            )}
          </form>

          {/* Right Column - Sticky Preview Panel (Desktop) */}
          <div className="hidden lg:block w-[420px] shrink-0 sticky top-24 space-y-4">
            {/* Venue Name Editor */}
            {isEditing && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Venue Name</Label>
                <Input
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  placeholder="Venue name"
                  className="text-lg font-bold"
                />
              </div>
            )}

            {/* Preview Header */}
            <div className="bg-muted rounded-t-xl px-4 py-3 border-b border-border">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Preview</span>
              <div className="bg-background mt-2 rounded-lg py-3 px-4 flex items-center justify-between border border-border">
                <span className="text-foreground text-sm font-medium">{previewName}</span>
              </div>
            </div>

            {/* Preview Content */}
            <Card className="rounded-t-none rounded-b-xl border-t-0 -mt-4">
              <CardContent className="p-6 space-y-6">
                {/* Multi-Court Toggle — only show on parent tab */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Box className="h-4 w-4 text-primary" /> Multi-Court Configuration
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Enable to subdivide this court</p>
                  </div>
                  {isActiveTabParent && !isAddingNewSubCourt && (
                    <Switch
                      checked={isMultiCourt || hasChildren}
                      disabled={hasChildren && isMultiCourt}
                      onCheckedChange={handleMultiCourtToggle}
                    />
                  )}
                </div>

                {/* Sub-Court Tabs */}
                {showMultiCourtConfig && (
                  <div className="space-y-4">
                    <div className="flex gap-2 flex-wrap border-b border-border pb-4">
                      {tabCourts.map((court, index) => (
                        <button
                          key={court.id}
                          type="button"
                          onClick={() => loadCourtDataIntoForm(court)}
                          className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                            !isAddingNewSubCourt && activeCourtId === court.id
                              ? "bg-primary/10 text-primary border-primary"
                              : "bg-muted text-muted-foreground border-border hover:text-foreground"
                          }`}
                        >
                          {index === 0 ? "Main Court" : court.name}
                        </button>
                      ))}
                      {isAddingNewSubCourt && (
                        <button type="button" className="px-4 py-1.5 rounded-full text-sm font-medium bg-primary/10 text-primary border border-primary">
                          New Sub-Court
                        </button>
                      )}
                      {!isAddingNewSubCourt && (
                        <button
                          type="button"
                          onClick={handleAddSubCourt}
                          className="px-3 py-1.5 rounded-full text-sm font-medium border border-dashed border-muted-foreground/40 text-muted-foreground hover:text-primary hover:border-primary flex items-center gap-1 transition-colors"
                        >
                          <Plus className="h-4 w-4" /> Add
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Court Preview */}
                <div className="flex gap-4">
                  <div className="w-40 h-28 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center shrink-0">
                    {previewPhoto ? (
                      <img src={previewPhoto} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex flex-col justify-start pt-1 min-w-0">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {isAddingNewSubCourt ? "New Sub-Court" : activeIsSubCourt ? "Sub-Court" : "Main Court"}
                    </span>
                    <span className="text-lg font-bold text-primary mt-0.5 truncate">{previewName}</span>
                    <div className="mt-3 space-y-1.5">
                      <div className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Rate:</span> ${previewRate}/hr
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Surface:</span> {previewSurface}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Delete action for editing */}
                {(isEditing || isAddingNewSubCourt) && (
                  <div className="pt-4 border-t border-border">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={isAddingNewSubCourt ? () => {
                        setIsAddingNewSubCourt(false);
                        if (parentCourt) loadCourtDataIntoForm(parentCourt);
                      } : handleDelete}
                      disabled={deleting}
                    >
                      {isAddingNewSubCourt ? t("courts.cancel") : deleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t("courts.deleteTitle")}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ManagerLayout>
  );
}

/* ===== Mobile Preview Panel Component ===== */
interface MobilePreviewPanelProps {
  isEditing: boolean;
  isMultiCourt: boolean;
  showMultiCourtConfig: boolean;
  hasChildren: boolean;
  tabCourts: VenueCourt[];
  selectedTabCourtId: string | null;
  isAddingNewSubCourt: boolean;
  effectiveParentId: string | null;
  activeCourt: VenueCourt | null;
  parentCourt: VenueCourt | null;
  isActiveTabParent: boolean;
  previewName: string;
  previewRate: number;
  previewSurface: string;
  previewPhoto: string | null;
  groundTypeLabels: Record<string, string>;
  onTabClick: (court: VenueCourt) => void;
  onAddSubCourt: () => void;
  onToggleMultiCourt: (checked: boolean) => void;
  venueName: string;
  onVenueNameChange: (name: string) => void;
}

function MobilePreviewPanel({
  isEditing,
  isMultiCourt,
  showMultiCourtConfig,
  hasChildren,
  tabCourts,
  selectedTabCourtId,
  isAddingNewSubCourt,
  effectiveParentId,
  activeCourt,
  parentCourt,
  isActiveTabParent,
  previewName,
  previewRate,
  previewSurface,
  previewPhoto,
  groundTypeLabels,
  onTabClick,
  onAddSubCourt,
  onToggleMultiCourt,
  venueName,
  onVenueNameChange,
}: MobilePreviewPanelProps) {
  if (!isEditing) return null;

  return (
    <Card className="rounded-2xl border border-border shadow-sm">
      <CardContent className="p-4 space-y-4">
        {/* Venue Name */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Venue</Label>
          <Input
            value={venueName}
            onChange={(e) => onVenueNameChange(e.target.value)}
            placeholder="Venue name"
            className="font-semibold"
          />
        </div>

        {/* Multi-Court Toggle — only on parent tab */}
        {isActiveTabParent && !isAddingNewSubCourt && (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Multi-Court</p>
              <p className="text-xs text-muted-foreground">Enable sub-courts</p>
            </div>
            <Switch
              checked={isMultiCourt || hasChildren}
              disabled={hasChildren && isMultiCourt}
              onCheckedChange={onToggleMultiCourt}
            />
          </div>
        )}

        {/* Tabs */}
        {showMultiCourtConfig && (
          <div className="flex gap-2 flex-wrap">
            {tabCourts.map((court, index) => (
              <button
                key={court.id}
                type="button"
                onClick={() => onTabClick(court)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  !isAddingNewSubCourt && selectedTabCourtId === court.id
                    ? "bg-primary/10 text-primary border-primary"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                {index === 0 ? "Main" : court.name}
              </button>
            ))}
            {isAddingNewSubCourt && (
              <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary">
                New
              </span>
            )}
            {!isAddingNewSubCourt && (
              <button
                type="button"
                onClick={onAddSubCourt}
                className="px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-muted-foreground/40 text-muted-foreground flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            )}
          </div>
        )}

        {/* Preview */}
        <div className="flex gap-3 items-center">
          <div className="w-20 h-14 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center shrink-0">
            {previewPhoto ? (
              <img src={previewPhoto} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-primary truncate">{previewName}</p>
            <p className="text-xs text-muted-foreground">${previewRate}/hr · {previewSurface}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
