import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export interface ProfileCompleteness {
  isComplete: boolean;
  missingFields: string[];
}

export function checkProfileComplete(profile: Profile | null): ProfileCompleteness {
  const missingFields: string[] = [];
  
  if (!profile?.full_name?.trim()) missingFields.push("Full Name");
  if (!profile?.city) missingFields.push("City");
  if (!profile?.nationality_code) missingFields.push("Nationality");
  
  const sports = profile?.preferred_sports as string[] | null;
  if (!sports || sports.length === 0) missingFields.push("Preferred Sports");
  
  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
}
