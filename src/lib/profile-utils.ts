import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export interface ProfileCompleteness {
  isComplete: boolean;
  missingFields: string[];
}

export function checkProfileComplete(profile: Profile | null): ProfileCompleteness {
  const missingFields: string[] = [];
  
  if (!profile?.full_name?.trim()) missingFields.push("Full Name");
  if (!profile?.phone?.trim()) missingFields.push("Phone Number");
  if (!profile?.city) missingFields.push("City");
  
  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
}
