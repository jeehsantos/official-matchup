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

    // Verify caller
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

    if (action === "add") {
      const { venue_id, email, password, full_name } = body;

      if (!venue_id || !email || !password || !full_name) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: venue_id, email, password, full_name" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate password length
      if (password.length < 6) {
        return new Response(
          JSON.stringify({ error: "Password must be at least 6 characters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify caller owns the venue
      const { data: venue, error: venueError } = await supabaseAdmin
        .from("venues")
        .select("id, owner_id")
        .eq("id", venue_id)
        .single();

      if (venueError || !venue) {
        return new Response(JSON.stringify({ error: "Venue not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (venue.owner_id !== callerId) {
        return new Response(JSON.stringify({ error: "Not authorized to manage this venue" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if a user with this email already exists
      const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw listError;

      const existingUser = listData.users.find(
        (u: any) => u.email?.toLowerCase() === email.toLowerCase()
      );

      if (existingUser) {
        return new Response(
          JSON.stringify({ error: "This email is already registered. Staff accounts must use a new email that is not associated with any existing account." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create new auth user for staff
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, role: "venue_staff" },
      });

      if (createError) throw createError;

      const userId = newUser.user.id;

      // Note: handle_new_user trigger automatically creates profile and user_roles
      // based on user_metadata, so we don't need to insert those manually.

      // Insert venue_staff link
      const { error: staffError } = await supabaseAdmin.from("venue_staff").insert({
        venue_id,
        user_id: userId,
        added_by: callerId,
      });

      if (staffError) {
        // Cleanup: delete user if staff link fails
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw staffError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          staff: { id: userId, email, full_name },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "remove") {
      const { staff_id, venue_id } = body;

      if (!staff_id || !venue_id) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: staff_id, venue_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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

      const staffUserId = staffRow.user_id;

      // Delete venue_staff row
      await supabaseAdmin.from("venue_staff").delete().eq("id", staff_id);

      // Check if user is staff at any other venue
      const { data: otherStaff } = await supabaseAdmin
        .from("venue_staff")
        .select("id")
        .eq("user_id", staffUserId)
        .limit(1);

      if (!otherStaff || otherStaff.length === 0) {
        // No more venue links — remove role and delete the auth user
        await supabaseAdmin.from("user_roles").delete().eq("user_id", staffUserId).eq("role", "venue_staff");
        await supabaseAdmin.auth.admin.deleteUser(staffUserId);
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
