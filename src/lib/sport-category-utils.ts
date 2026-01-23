import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type SportType = Database["public"]["Enums"]["sport_type"];
type SportCategory = Database["public"]["Tables"]["sport_categories"]["Row"];

// In-memory cache for sport categories
let sportCategoriesCache: Map<string, SportCategory> | null = null;
let cachePromise: Promise<void> | null = null;

/**
 * Initialize the sport categories cache
 */
async function initializeSportCategoriesCache(): Promise<void> {
  if (sportCategoriesCache) return;

  const { data: categories, error } = await supabase
    .from("sport_categories")
    .select("*")
    .eq("is_active", true);

  if (error) {
    console.error("Error fetching sport categories:", error);
    sportCategoriesCache = new Map();
    return;
  }

  sportCategoriesCache = new Map(
    (categories || []).map((category) => [category.name, category])
  );
}

/**
 * Get sport category display name from sport_type
 * Returns "Sport TBD" if category not found
 */
export async function getSportCategoryDisplay(
  sportType: SportType
): Promise<string> {
  // Ensure cache is initialized
  if (!sportCategoriesCache) {
    if (!cachePromise) {
      cachePromise = initializeSportCategoriesCache();
    }
    await cachePromise;
  }

  const category = sportCategoriesCache?.get(sportType);
  return category?.display_name || "Sport TBD";
}

/**
 * Get full sport category object from sport_type
 * Returns null if category not found
 */
export async function getSportCategory(
  sportType: SportType
): Promise<SportCategory | null> {
  // Ensure cache is initialized
  if (!sportCategoriesCache) {
    if (!cachePromise) {
      cachePromise = initializeSportCategoriesCache();
    }
    await cachePromise;
  }

  return sportCategoriesCache?.get(sportType) || null;
}

/**
 * Get all sport categories as a lookup map
 * Useful for batch operations
 */
export async function getSportCategoriesMap(): Promise<
  Map<string, SportCategory>
> {
  // Ensure cache is initialized
  if (!sportCategoriesCache) {
    if (!cachePromise) {
      cachePromise = initializeSportCategoriesCache();
    }
    await cachePromise;
  }

  return sportCategoriesCache || new Map();
}

/**
 * Clear the cache (useful for testing or when categories are updated)
 */
export function clearSportCategoriesCache(): void {
  sportCategoriesCache = null;
  cachePromise = null;
}
