import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Equipment {
  id: string;
  venue_id: string;
  name: string;
  description: string | null;
  price_per_unit: number;
  quantity_available: number;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEquipmentInput {
  venue_id: string;
  name: string;
  description?: string;
  price_per_unit: number;
  quantity_available: number;
}

export interface UpdateEquipmentInput {
  id: string;
  name?: string;
  description?: string;
  price_per_unit?: number;
  quantity_available?: number;
  is_active?: boolean;
}

export function useVenueEquipment(venueId: string | null) {
  return useQuery({
    queryKey: ["venue-equipment", venueId],
    queryFn: async () => {
      if (!venueId) return [];
      const { data, error } = await supabase
        .from("equipment_inventory")
        .select("*")
        .eq("venue_id", venueId)
        .order("name", { ascending: true });

      if (error) throw error;
      return data as Equipment[];
    },
    enabled: !!venueId,
  });
}

export function useCreateEquipment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateEquipmentInput) => {
      const { data, error } = await supabase
        .from("equipment_inventory")
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as Equipment;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["venue-equipment", data.venue_id] });
      toast({ title: "Equipment added successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add equipment",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateEquipment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: UpdateEquipmentInput) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from("equipment_inventory")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Equipment;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["venue-equipment", data.venue_id] });
      toast({ title: "Equipment updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update equipment",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteEquipment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, venueId }: { id: string; venueId: string }) => {
      const { error } = await supabase
        .from("equipment_inventory")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { id, venueId };
    },
    onSuccess: ({ venueId }) => {
      queryClient.invalidateQueries({ queryKey: ["venue-equipment", venueId] });
      toast({ title: "Equipment deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete equipment",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
