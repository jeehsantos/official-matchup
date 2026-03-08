import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { booking_id, new_date, new_start_time, new_end_time } = await req.json();

    if (!booking_id || !new_date || !new_start_time || !new_end_time) {
      return new Response(
        JSON.stringify({ error: "booking_id, new_date, new_start_time, new_end_time are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch the current booking
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("court_availability")
      .select("id, court_id, available_date, start_time, end_time, is_booked, booked_by_session_id, booked_by_user_id, booked_by_group_id, payment_status")
      .eq("id", booking_id)
      .single();

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Verify the manager owns the court's venue
    const { data: court, error: courtError } = await supabaseAdmin
      .from("courts")
      .select("id, venue_id, venue:venues(id, owner_id)")
      .eq("id", booking.court_id)
      .single();

    if (courtError || !court) {
      return new Response(JSON.stringify({ error: "Court not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const venue = court.venue as any;
    if (venue?.owner_id !== userId) {
      return new Response(JSON.stringify({ error: "You are not the owner of this venue" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Check for overlapping bookings at the new date/time
    const { data: overlaps } = await supabaseAdmin
      .from("court_availability")
      .select("id")
      .eq("court_id", booking.court_id)
      .eq("available_date", new_date)
      .eq("is_booked", true)
      .lt("start_time", new_end_time)
      .gt("end_time", new_start_time)
      .neq("id", booking_id);

    if (overlaps && overlaps.length > 0) {
      return new Response(
        JSON.stringify({ error: "SLOT_UNAVAILABLE", message: "The selected time slot overlaps with an existing booking" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Check for active holds on the new slot
    const newStartDatetime = `${new_date}T${new_start_time}`;
    const newEndDatetime = `${new_date}T${new_end_time}`;

    const { data: holdOverlaps } = await supabaseAdmin
      .from("booking_holds")
      .select("id")
      .eq("court_id", booking.court_id)
      .eq("status", "HELD")
      .gt("expires_at", new Date().toISOString())
      .lt("start_datetime", newEndDatetime)
      .gt("end_datetime", newStartDatetime);

    if (holdOverlaps && holdOverlaps.length > 0) {
      return new Response(
        JSON.stringify({ error: "SLOT_HELD", message: "This slot is temporarily held by another user" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Update the court_availability row
    const { error: updateError } = await supabaseAdmin
      .from("court_availability")
      .update({
        available_date: new_date,
        start_time: new_start_time,
        end_time: new_end_time,
      })
      .eq("id", booking_id);

    if (updateError) {
      console.error("Failed to update court_availability:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update booking", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. If there's a linked session, update it too
    if (booking.booked_by_session_id) {
      const [sh, sm] = new_start_time.split(":").map(Number);
      const [eh, em] = new_end_time.split(":").map(Number);
      const newDurationMinutes = (eh * 60 + em) - (sh * 60 + sm);

      const { error: sessionError } = await supabaseAdmin
        .from("sessions")
        .update({
          session_date: new_date,
          start_time: new_start_time,
          duration_minutes: newDurationMinutes,
        })
        .eq("id", booking.booked_by_session_id);

      if (sessionError) {
        console.error("Failed to update session:", sessionError);
        // Non-fatal: booking is already moved, log the session update failure
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Booking rescheduled successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in reschedule-booking:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
