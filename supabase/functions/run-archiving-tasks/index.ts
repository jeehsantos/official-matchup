// Supabase Edge Function for running archiving tasks
// This function should be triggered by a cron job or manually

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting archiving tasks...");

    // Run all archiving tasks with logging
    const { data, error } = await supabase.rpc("run_all_archiving_tasks_with_logging");

    if (error) {
      console.error("Error running archiving tasks:", error);
      throw error;
    }

    // Get the results from the logs
    const { data: logs, error: logsError } = await supabase
      .from("archiving_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    if (logsError) {
      console.error("Error fetching logs:", logsError);
    }

    console.log("Archiving tasks completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Archiving tasks completed successfully",
        logs: logs || [],
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in archiving function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
