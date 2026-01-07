import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ManagerLayout } from "@/components/layout/ManagerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Constants } from "@/integrations/supabase/types";

const sportTypes = Constants.sport_type;

const courtSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  sport_type: z.enum(sportTypes as [string, ...string[]]),
  capacity: z.number().min(1).max(100),
  hourly_rate: z.number().min(0),
  is_indoor: z.boolean(),
  is_active: z.boolean(),
  photo_url: z.string().url("Invalid URL").optional().or(z.literal("")),
});

type CourtFormData = z.infer<typeof courtSchema>;

export default function ManagerCourtForm() {
  const { venueId, courtId } = useParams<{ venueId: string; courtId: string }>();
  const isEditing = courtId !== "new";
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);

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
      capacity: 10,
      hourly_rate: 50,
      is_indoor: false,
      is_active: true,
    },
  });

  useEffect(() => {
    if (isEditing && courtId) {
      fetchCourt();
    }
  }, [courtId, isEditing]);

  const fetchCourt = async () => {
    try {
      const { data, error } = await supabase
        .from("courts")
        .select("*")
        .eq("id", courtId)
        .single();

      if (error) throw error;
      
      reset({
        name: data.name,
        sport_type: data.sport_type,
        capacity: data.capacity,
        hourly_rate: Number(data.hourly_rate),
        is_indoor: data.is_indoor ?? false,
        is_active: data.is_active ?? true,
        photo_url: data.photo_url || "",
      });
    } catch (error) {
      console.error("Error fetching court:", error);
      navigate(`/manager/venues/${venueId}/courts`);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: CourtFormData) => {
    if (!user || !venueId) return;
    
    setSubmitting(true);
    try {
      if (isEditing) {
        const { error } = await supabase
          .from("courts")
          .update({
            name: data.name,
            sport_type: data.sport_type as any,
            capacity: data.capacity,
            hourly_rate: data.hourly_rate,
            is_indoor: data.is_indoor,
            is_active: data.is_active,
            photo_url: data.photo_url || null,
          })
          .eq("id", courtId);

        if (error) throw error;
        toast({ title: "Court updated successfully" });
      } else {
        const { error } = await supabase
          .from("courts")
          .insert({
            venue_id: venueId,
            name: data.name,
            sport_type: data.sport_type as any,
            capacity: data.capacity,
            hourly_rate: data.hourly_rate,
            is_indoor: data.is_indoor,
            is_active: data.is_active,
            photo_url: data.photo_url || null,
          });

        if (error) throw error;
        toast({ title: "Court created successfully" });
      }
      
      navigate(`/manager/venues/${venueId}/courts`);
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
              {isEditing ? "Update court details" : "Add a new court to your venue"}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                  placeholder="e.g., Court 1, Main Arena"
                  className="mt-1"
                />
                {errors.name && (
                  <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="sport_type">Sport Type *</Label>
                <Select
                  value={watch("sport_type")}
                  onValueChange={(value) => setValue("sport_type", value as any)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a sport" />
                  </SelectTrigger>
                  <SelectContent>
                    {sportTypes.map((sport) => (
                      <SelectItem key={sport} value={sport} className="capitalize">
                        {sport}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.sport_type && (
                  <p className="text-sm text-destructive mt-1">{errors.sport_type.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="capacity">Max Players *</Label>
                  <Input
                    id="capacity"
                    type="number"
                    {...register("capacity", { valueAsNumber: true })}
                    className="mt-1"
                  />
                  {errors.capacity && (
                    <p className="text-sm text-destructive mt-1">{errors.capacity.message}</p>
                  )}
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
              </div>

              <div>
                <Label htmlFor="photo_url">Photo URL</Label>
                <Input
                  id="photo_url"
                  {...register("photo_url")}
                  placeholder="https://example.com/court-photo.jpg"
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
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              isEditing ? "Update Court" : "Create Court"
            )}
          </Button>
        </form>
      </div>
    </ManagerLayout>
  );
}
