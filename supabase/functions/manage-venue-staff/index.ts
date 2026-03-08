import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub as string;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { action } = body;

    // Helper: get all venues owned by caller
    async function getCallerVenues(): Promise<{ id: string }[]> {
      const { data, error } = await supabaseAdmin
        .from("venues")
        .select("id")
        .eq("owner_id", callerId);
      if (error) throw error;
      return data || [];
    }

    if (action === "add") {
      const { email, password, full_name } = body;

      if (!email || !password || !full_name) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: email, password, full_name" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (password.length < 6) {
        return new Response(
          JSON.stringify({ error: "Password must be at least 6 characters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get all venues owned by caller
      const venues = await getCallerVenues();
      if (venues.length === 0) {
        return new Response(
          JSON.stringify({ error: "You don't have any venues" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if email already exists
      const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw listError;

      const existingUser = listData.users.find(
        (u: any) => u.email?.toLowerCase() === email.toLowerCase()
      );

      if (existingUser) {
        return new Response(
          JSON.stringify({ success: false, error: "This email is already registered. Staff accounts must use a new email that is not associated with any existing account." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create new auth user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, role: "venue_staff" },
      });

      if (createError) throw createError;

      const userId = newUser.user.id;

      // Insert venue_staff link for ALL venues
      const staffRows = venues.map((v) => ({
        venue_id: v.id,
        user_id: userId,
        added_by: callerId,
      }));

      const { error: staffError } = await supabaseAdmin.from("venue_staff").insert(staffRows);

      if (staffError) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw staffError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          staff: { id: userId, email, full_name },
          venues_assigned: venues.length,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "remove") {
      const { staff_id, venue_id } = body;

      if (!staff_id) {
        return new Response(
          JSON.stringify({ error: "Missing required field: staff_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If venue_id provided, remove from that venue only. Otherwise remove from ALL caller's venues.
      if (venue_id) {
        // Verify caller owns the venue
        const { data: venue, error: venueError } = await supabaseAdmin
          .from("venues")
          .select("id, owner_id")
          .eq("id", venue_id)
          .single();

        if (venueError || !venue || venue.owner_id !== callerId) {
          return new Response(JSON.stringify({ error: "Not authorized" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get user_id from venue_staff
        const { data: staffRow, error: staffLookupError } = await supabaseAdmin
          .from("venue_staff")
          .select("user_id")
          .eq("id", staff_id)
          .eq("venue_id", venue_id)
          .single();

        if (staffLookupError || !staffRow) {
          return new Response(JSON.stringify({ error: "Staff member not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await supabaseAdmin.from("venue_staff").delete().eq("id", staff_id);

        const staffUserId = staffRow.user_id;
        const { data: otherStaff } = await supabaseAdmin
          .from("venue_staff")
          .select("id")
          .eq("user_id", staffUserId)
          .limit(1);

        if (!otherStaff || otherStaff.length === 0) {
          await supabaseAdmin.from("user_roles").delete().eq("user_id", staffUserId).eq("role", "venue_staff");
          await supabaseAdmin.auth.admin.deleteUser(staffUserId);
        }
      } else {
        // Remove from all caller's venues - look up user_id first
        const { data: staffRow } = await supabaseAdmin
          .from("venue_staff")
          .select("user_id")
          .eq("id", staff_id)
          .single();

        if (!staffRow) {
          return new Response(JSON.stringify({ error: "Staff member not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const staffUserId = staffRow.user_id;
        const callerVenues = await getCallerVenues();
        const venueIds = callerVenues.map((v) => v.id);

        // Delete all venue_staff rows for this user across caller's venues
        await supabaseAdmin
          .from("venue_staff")
          .delete()
          .eq("user_id", staffUserId)
          .in("venue_id", venueIds);

        // Check if user is staff at any other venue
        const { data: remaining } = await supabaseAdmin
          .from("venue_staff")
          .select("id")
          .eq("user_id", staffUserId)
          .limit(1);

        if (!remaining || remaining.length === 0) {
          await supabaseAdmin.from("user_roles").delete().eq("user_id", staffUserId).eq("role", "venue_staff");
          await supabaseAdmin.auth.admin.deleteUser(staffUserId);
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("manage-venue-staff error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
