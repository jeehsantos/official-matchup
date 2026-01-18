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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Trash2, Building2, Plus, Link as LinkIcon, DollarSign, ChevronDown, ChevronUp, Camera, MapPin, CreditCard, Settings2 } from "lucide-react";
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
  is_indoor: boolean | null;
  payment_timing: string | null;
  payment_hours_before: number | null;
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
  const [venueData, setVenueData] = useState<any>(null);
  
  // Multi-court state
  const [selectedTabCourtId, setSelectedTabCourtId] = useState<string | null>(null);
  const [isAddingNewSubCourt, setIsAddingNewSubCourt] = useState(false);
  const [multiCourtExpanded, setMultiCourtExpanded] = useState(true);
  
  // Collapsible section states
  const [photosExpanded, setPhotosExpanded] = useState(true);
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [locationExpanded, setLocationExpanded] = useState(true);
  const [settingsExpanded, setSettingsExpanded] = useState(true);
  
  // The ID of the parent court (for existing edits this is the URL id, for new sub-courts we track it)
  const [parentCourtId, setParentCourtId] = useState<string | null>(null);
  
  // Fetch other courts at the same venue (for multi-court display)
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
  
  // Fetch surface types from database - NO FALLBACKS
  const { data: surfaceTypesData = [], isLoading: loadingSurfaceTypes } = useSurfaceTypes();
  
  // Build ground types from database ONLY
  const groundTypes = useMemo(() => {
    return surfaceTypesData.map(s => s.name);
  }, [surfaceTypesData]);
  
  const groundTypeLabels = useMemo(() => {
    return Object.fromEntries(surfaceTypesData.map(s => [s.name, s.display_name]));
  }, [surfaceTypesData]);

  // Get the current court being edited (from URL id)
  const currentCourt = venueCourts.find(c => c.id === id);
  
  // Check if this court is a multi-court parent
  const isCurrentCourtMultiParent = currentCourt?.is_multi_court || false;
  
  // Determine the effective parent ID for multi-court display
  // If current court is a parent, use its ID. If it's a child, use its parent_court_id
  const effectiveParentId = useMemo(() => {
    if (!currentCourt) return id || null;
    if (currentCourt.is_multi_court) return currentCourt.id;
    if (currentCourt.parent_court_id) return currentCourt.parent_court_id;
    return currentCourt.id;
  }, [currentCourt, id]);
  
  // Get the parent court for display
  const parentCourt = venueCourts.find(c => c.id === effectiveParentId);
  
  // Check if we should show multi-court config (if current is parent OR has parent)
  const showMultiCourtConfig = isCurrentCourtMultiParent || (currentCourt?.parent_court_id != null);
  
  // Get child courts linked to parent
  const childCourts = useMemo(() => {
    if (!effectiveParentId) return [];
    return venueCourts.filter(c => c.parent_court_id === effectiveParentId);
  }, [venueCourts, effectiveParentId]);

  // All courts to show in tabs: parent + children
  const tabCourts = useMemo(() => {
    if (!effectiveParentId) return [];
    const parent = venueCourts.find(c => c.id === effectiveParentId);
    return parent ? [parent, ...childCourts] : [];
  }, [venueCourts, effectiveParentId, childCourts]);

  // Get selected tab court details
  const selectedTabCourt = useMemo(() => {
    if (isAddingNewSubCourt) return null;
    if (!selectedTabCourtId) return null;
    return venueCourts.find(c => c.id === selectedTabCourtId) || null;
  }, [venueCourts, selectedTabCourtId, isAddingNewSubCourt]);

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
      fetchCourt(id);
    }
  }, [id, isEditing]);

  // When editing, set the selected tab to the current court
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
          venue:venues(id, name, address, city, suburb, country, owner_id)
        `)
        .eq("id", courtId)
        .single();

      if (error) throw error;
      
      // Verify ownership
      if (data.venue?.owner_id !== user?.id) {
        navigate("/manager/courts");
        return;
      }

      setExistingVenueId(data.venue_id);
      setVenueName(data.venue?.name || "");
      setVenueData(data.venue);
      setParentCourtId(data.parent_court_id || data.id);
      
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

  // Load selected tab court data into form (for editing existing sub-court)
  const loadCourtDataIntoForm = async (court: VenueCourt) => {
    setIsAddingNewSubCourt(false);
    setSelectedTabCourtId(court.id);
    
    // Update URL without full navigation to keep state
    window.history.replaceState(null, '', `/manager/courts/${court.id}/edit`);
    
    // Load the court data into the form
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

  // State to track new sub-court photo URLs separately (for preview before save)
  const [newSubCourtPhotos, setNewSubCourtPhotos] = useState<string[]>([]);
  
  // Start adding a new sub-court - clear form for new entry
  const handleAddSubCourt = () => {
    setIsAddingNewSubCourt(true);
    setSelectedTabCourtId(null);
    setNewSubCourtPhotos([]); // Clear photos for new sub-court
    
    // Clear form with defaults for new sub-court
    reset({
      name: `Sub-Court ${childCourts.length + 1}`,
      ground_type: surfaceTypesData.length > 0 ? surfaceTypesData[0].name : "",
      hourly_rate: parentCourt?.hourly_rate || 50,
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
      title: "Add New Sub-Court", 
      description: "Fill in the details on the left and click Save to create the sub-court."
    });
  };

  const onSubmit = async (data: CourtFormData) => {
    if (!user) return;
    
    setSubmitting(true);
    try {
      // If adding new sub-court
      if (isAddingNewSubCourt && existingVenueId && effectiveParentId) {
        const { data: newCourt, error: courtError } = await supabase
          .from("courts")
          .insert([{
            venue_id: existingVenueId,
            name: data.name,
            sport_type: "futsal" as any,
            ground_type: data.ground_type as any,
            hourly_rate: data.hourly_rate,
            is_indoor: data.is_indoor,
            is_active: data.is_active,
            is_multi_court: false, // Sub-courts are never multi-court parents
            parent_court_id: effectiveParentId,
            photo_urls: data.photo_urls,
            photo_url: data.photo_urls[0] || null,
            payment_timing: data.payment_timing as any,
            payment_hours_before: data.payment_hours_before,
            rules: data.rules || null,
          } as any])
          .select()
          .single();

        if (courtError) throw courtError;
        
        // Refresh courts list
        await refetchCourts();
        
        // Switch to viewing the new court
        setIsAddingNewSubCourt(false);
        setSelectedTabCourtId(newCourt.id);
        
        // Update URL to the new court
        window.history.replaceState(null, '', `/manager/courts/${newCourt.id}/edit`);
        
        toast({ title: "Sub-court created successfully" });
        return;
      }
      
      if (isEditing && existingVenueId) {
        // Update existing court and venue
        const { error: venueError } = await supabase
          .from("venues")
          .update({
            name: venueName,
            address: data.address,
            city: data.city,
            suburb: data.suburb || null,
            country: data.country,
          })
          .eq("id", existingVenueId);

        if (venueError) throw venueError;

        const courtId = selectedTabCourtId || id;
        
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
          } as any)
          .eq("id", courtId);

        if (courtError) throw courtError;
        
        // Refresh courts list
        await refetchCourts();
        
        toast({ title: "Court updated successfully" });
      } else {
        // Create new venue and court
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
          }])
          .select()
          .single();

        if (venueError) throw venueError;

        const { error: courtError } = await supabase
          .from("courts")
          .insert([{
            venue_id: newVenueData.id,
            name: data.name,
            sport_type: "futsal" as any,
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
          } as any]);

        if (courtError) throw courtError;
        toast({ title: "Court created successfully" });
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
    const courtIdToDelete = selectedTabCourtId || id;
    if (!confirm("Are you sure you want to delete this court?")) {
      return;
    }

    setDeleting(true);
    try {
      // Delete court first
      const { error: courtError } = await supabase
        .from("courts")
        .delete()
        .eq("id", courtIdToDelete);

      if (courtError) throw courtError;

      // If we deleted a sub-court, stay on the page and switch to parent
      if (selectedTabCourtId && selectedTabCourtId !== id) {
        await refetchCourts();
        setSelectedTabCourtId(id);
        const parent = venueCourts.find(c => c.id === id);
        if (parent) {
          loadCourtDataIntoForm(parent);
        }
        toast({ title: "Sub-court deleted successfully" });
        return;
      }

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

  // Multi-Court Configuration Component
  const MultiCourtConfiguration = () => (
    <Card className="bg-card border-border shadow-sm">
      <Collapsible open={multiCourtExpanded} onOpenChange={setMultiCourtExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <LinkIcon className="h-4 w-4 text-primary" />
                Multi-Court Configuration
              </CardTitle>
              {multiCourtExpanded ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Is Multi-Court Toggle - Only show for parent courts and when parent tab is selected */}
            {(!currentCourt?.parent_court_id) && (!isAddingNewSubCourt && (selectedTabCourtId === effectiveParentId || !selectedTabCourtId)) && (
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
            )}

            {/* Show parent court info if current is a sub-court */}
            {currentCourt?.parent_court_id && parentCourt && (
              <div className="p-3 rounded-lg bg-[#00f2ea]/5 border border-[#00f2ea]/20">
                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Parent Court</p>
                <p className="text-[#00f2ea] font-bold">{parentCourt.name}</p>
              </div>
            )}

            {/* Tabs for courts - Show when Multi-Court is enabled OR when viewing multi-court family */}
            {(isMultiCourt || showMultiCourtConfig) && (
              <div className="space-y-4 pt-4 border-t border-[#00f2ea]/10">
                {/* Court Tabs */}
                <div className="flex items-center gap-2 flex-wrap">
                  {tabCourts.map((court, index) => (
                    <button
                      key={court.id}
                      type="button"
                      onClick={() => loadCourtDataIntoForm(court)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        !isAddingNewSubCourt && selectedTabCourtId === court.id
                          ? 'bg-[#00f2ea]/20 text-[#00f2ea] border border-[#00f2ea] shadow-[0_0_10px_rgba(0,242,234,0.3)]'
                          : 'bg-[#0a0f18] text-gray-400 hover:text-white border border-transparent'
                      }`}
                    >
                      {index === 0 ? 'Main Court' : court.name}
                    </button>
                  ))}
                  
                  {/* New Sub-Court Tab (when adding) */}
                  {isAddingNewSubCourt && (
                    <button
                      type="button"
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-[#00f2ea]/20 text-[#00f2ea] border border-[#00f2ea] shadow-[0_0_10px_rgba(0,242,234,0.3)]"
                    >
                      New Sub-Court
                    </button>
                  )}
                  
                  {/* Add Sub-Court Button - Only for parent courts */}
                  {(isMultiCourt || currentCourt?.is_multi_court) && !isAddingNewSubCourt && (
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
                  )}
                </div>

                {/* Selected Court Preview - for existing sub-courts */}
                {selectedTabCourt && !isAddingNewSubCourt && selectedTabCourtId !== effectiveParentId && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                          {selectedTabCourt.name}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Surface Type</p>
                        <p className="text-white">
                          {groundTypeLabels[selectedTabCourt.ground_type || ""] || selectedTabCourt.ground_type || "Unknown"}
                        </p>
                      </div>

                      <div className="flex justify-between items-center">
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Hourly Rate</p>
                        <p className="text-white font-bold">
                          ${selectedTabCourt.hourly_rate} NZD
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Main Court Preview - when parent is selected */}
                {selectedTabCourtId === effectiveParentId && parentCourt && !isAddingNewSubCourt && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl overflow-hidden aspect-video bg-[#0a0f18]">
                      {(parentCourt.photo_urls?.[0] || parentCourt.photo_url) ? (
                        <img 
                          src={parentCourt.photo_urls?.[0] || parentCourt.photo_url || ""} 
                          alt={parentCourt.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600">
                          <Building2 className="h-12 w-12" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Main Court</p>
                        <p className="text-[#00f2ea] font-bold text-lg">{parentCourt.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Surface Type</p>
                        <p className="text-white">
                          {groundTypeLabels[parentCourt.ground_type || ""] || parentCourt.ground_type || "Unknown"}
                        </p>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Hourly Rate</p>
                        <p className="text-white font-bold">${parentCourt.hourly_rate} NZD</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* New Sub-Court Placeholder */}
                {isAddingNewSubCourt && (
                  <div className="p-4 rounded-lg bg-[#00f2ea]/5 border border-dashed border-[#00f2ea]/30">
                    <p className="text-[#00f2ea] font-medium">Creating New Sub-Court</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Fill in the court details on the left and click "Create Sub-Court" to save.
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );

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
              {isAddingNewSubCourt ? "Add Sub-Court" : isEditing ? "Edit Court" : "Add Court"}
            </h1>
            <p className="text-muted-foreground">
              {isAddingNewSubCourt ? "Create a new sub-court" : isEditing ? "Update court details" : "Register a new sports court"}
            </p>
          </div>
        </div>

        {/* Mobile: Multi-Court Configuration at top */}
        <div className="lg:hidden">
          {isEditing && <MultiCourtConfiguration />}
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column - Form */}
          <div className="space-y-6">
            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Photo Upload - Collapsible */}
              <Card className="bg-card border-border shadow-sm">
                <Collapsible open={photosExpanded} onOpenChange={setPhotosExpanded}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Camera className="h-4 w-4 text-primary" />
                          Court Photos
                        </CardTitle>
                        {photosExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <CourtPhotosUpload
                        key={isAddingNewSubCourt ? 'new-sub-court' : selectedTabCourtId || id}
                        currentPhotoUrls={isAddingNewSubCourt ? newSubCourtPhotos : (watch("photo_urls") || [])}
                        onPhotosChanged={(urls) => {
                          if (isAddingNewSubCourt) {
                            setNewSubCourtPhotos(urls);
                            setValue("photo_urls", urls);
                          } else {
                            setValue("photo_urls", urls);
                          }
                        }}
                        maxPhotos={4}
                      />
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Court Details - Collapsible */}
              <Card className="bg-card border-border shadow-sm">
                <Collapsible open={detailsExpanded} onOpenChange={setDetailsExpanded}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Building2 className="h-4 w-4 text-primary" />
                          Court Details
                        </CardTitle>
                        {detailsExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-4 pt-0">
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
                          placeholder="Enter any rules, restrictions, or guidelines for players booking this court..."
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
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Location - Collapsible */}
              <Card className="bg-card border-border shadow-sm">
                <Collapsible open={locationExpanded} onOpenChange={setLocationExpanded}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <MapPin className="h-4 w-4 text-primary" />
                          Location
                        </CardTitle>
                        {locationExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-4 pt-0">
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
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Payment Settings */}
              <PaymentSettingsCard
                paymentTiming={paymentTiming}
                paymentHoursBefore={paymentHoursBefore}
                onPaymentTimingChange={(timing) => setValue("payment_timing", timing)}
                onPaymentHoursChange={(hours) => setValue("payment_hours_before", hours)}
              />

              {/* Settings - Collapsible */}
              <Card className="bg-card border-border shadow-sm">
                <Collapsible open={settingsExpanded} onOpenChange={setSettingsExpanded}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Settings2 className="h-4 w-4 text-primary" />
                          Settings
                        </CardTitle>
                        {settingsExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-4 pt-0">
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
                  </CollapsibleContent>
                </Collapsible>
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
                    isAddingNewSubCourt ? "Create Sub-Court" : isEditing ? "Update Court" : "Create Court"
                  )}
                </Button>
                
                {(isEditing || isAddingNewSubCourt) && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={isAddingNewSubCourt ? () => {
                      setIsAddingNewSubCourt(false);
                      if (parentCourt) loadCourtDataIntoForm(parentCourt);
                    } : handleDelete}
                    disabled={deleting}
                  >
                    {isAddingNewSubCourt ? (
                      "Cancel"
                    ) : deleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </form>
          </div>

          {/* Right Column - Desktop Multi-Court Configuration */}
          <div className="hidden lg:block space-y-6">
            {/* Court Details Header - Always visible when editing */}
            {isEditing && (
              <Card className="bg-[#111a27]/60 border-[#00f2ea]/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-400">Venue</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    value={venueName}
                    onChange={(e) => setVenueName(e.target.value)}
                    placeholder="Venue name"
                    className="text-xl font-bold text-white bg-[#0a0f18] border-[#00f2ea]/20 focus:border-[#00f2ea]"
                  />
                  <p className="text-gray-500 text-sm">
                    {isAddingNewSubCourt ? "Adding new sub-court" : 
                     currentCourt?.parent_court_id ? "Sub-Court" : 
                     isMultiCourt ? "Multi-Court Parent" : "Single Court"}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Multi-Court Configuration */}
            {isEditing && <MultiCourtConfiguration />}
          </div>
        </div>
      </div>
    </ManagerLayout>
  );
}
