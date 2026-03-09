import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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
    const { groupId, targetUserId, reason, action } = await req.json();

    if (!groupId || !targetUserId) {
      throw new Error("groupId and targetUserId are required");
    }

    if (!action || !["remove", "ban"].includes(action)) {
      throw new Error("action must be 'remove' or 'ban'");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } =
      await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Not authenticated");

    const callerId = userData.user.id;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify caller is organizer or co-organizer
    const { data: group, error: groupError } = await supabaseAdmin
      .from("groups")
      .select("id, organizer_id")
      .eq("id", groupId)
      .single();

    if (groupError || !group) throw new Error("Group not found");

    const isOrganizer = group.organizer_id === callerId;

    let isCoOrganizer = false;
    if (!isOrganizer) {
      const { data: callerMember } = await supabaseAdmin
        .from("group_members")
        .select("is_admin")
        .eq("group_id", groupId)
        .eq("user_id", callerId)
        .single();

      isCoOrganizer = callerMember?.is_admin === true;
    }

    if (!isOrganizer && !isCoOrganizer) {
      throw new Error("Only organizers and co-organizers can remove/ban members");
    }

    // Cannot ban/remove the organizer
    if (targetUserId === group.organizer_id) {
      throw new Error("Cannot remove or ban the group organizer");
    }

    // If caller is co-organizer, they cannot ban other co-organizers
    if (isCoOrganizer && !isOrganizer) {
      const { data: targetMember } = await supabaseAdmin
        .from("group_members")
        .select("is_admin")
        .eq("group_id", groupId)
        .eq("user_id", targetUserId)
        .single();

      if (targetMember?.is_admin === true) {
        throw new Error("Co-organizers cannot remove other co-organizers");
      }
    }

    // If action is "ban", insert ban record
    if (action === "ban") {
      const { error: banError } = await supabaseAdmin
        .from("group_bans")
        .upsert(
          {
            group_id: groupId,
            user_id: targetUserId,
            banned_by: callerId,
            reason: reason || null,
          },
          { onConflict: "group_id,user_id" }
        );

      if (banError) {
        console.error("Error creating ban:", banError);
        throw new Error("Failed to ban user");
      }
    }

    // Remove from group_members
    const { error: removeError } = await supabaseAdmin
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", targetUserId);

    if (removeError) {
      console.error("Error removing member:", removeError);
      throw new Error("Failed to remove member");
    }

    // Remove from active session_players for this group's sessions
    const { data: activeSessions } = await supabaseAdmin
      .from("sessions")
      .select("id")
      .eq("group_id", groupId)
      .eq("is_cancelled", false)
      .gte("session_date", new Date().toISOString().split("T")[0]);

    if (activeSessions && activeSessions.length > 0) {
      const sessionIds = activeSessions.map((s) => s.id);
      const { error: spError } = await supabaseAdmin
        .from("session_players")
        .delete()
        .in("session_id", sessionIds)
        .eq("user_id", targetUserId);

      if (spError) {
        console.error("Error removing from sessions:", spError);
        // Non-fatal, continue
      }
    }

    console.log(
      `User ${targetUserId} ${action === "ban" ? "banned from" : "removed from"} group ${groupId} by ${callerId}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        action,
        message:
          action === "ban"
            ? "Member has been banned from the group"
            : "Member has been removed from the group",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("Error in ban-group-member:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
