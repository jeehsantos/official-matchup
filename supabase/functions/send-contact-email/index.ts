import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { name, email, subject, message } = await req.json();

    if (!name || !email || !subject || !message) {
      return new Response(
        JSON.stringify({ error: "All fields are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save to contact_messages table
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: dbError } = await supabase.from("contact_messages").insert({
      name,
      email,
      subject,
      message,
    });

    if (dbError) {
      console.error("DB insert error:", dbError);
      throw new Error("Failed to save contact message");
    }

    // Send email notification if CONTACT_EMAIL is configured
    const contactEmail = Deno.env.get("CONTACT_EMAIL");

    if (contactEmail) {
      const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
      if (lovableApiKey) {
        try {
          const emailResponse = await fetch("https://api.lovable.dev/v1/email/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${lovableApiKey}`,
            },
            body: JSON.stringify({
              to: contactEmail,
              subject: `[Sport Arena Contact] ${subject}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #1a1a1a; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
                    New Contact Message
                  </h2>
                  <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
                    <tr>
                      <td style="padding: 8px 12px; font-weight: bold; color: #555; width: 100px;">From:</td>
                      <td style="padding: 8px 12px;">${name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 12px; font-weight: bold; color: #555;">Email:</td>
                      <td style="padding: 8px 12px;"><a href="mailto:${email}">${email}</a></td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 12px; font-weight: bold; color: #555;">Subject:</td>
                      <td style="padding: 8px 12px;">${subject}</td>
                    </tr>
                  </table>
                  <div style="margin-top: 20px; padding: 16px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #2563eb;">
                    <p style="color: #333; white-space: pre-wrap; margin: 0;">${message}</p>
                  </div>
                  <p style="margin-top: 20px; font-size: 12px; color: #999;">
                    This message was sent via the Sport Arena contact form.
                  </p>
                </div>
              `,
              purpose: "transactional",
            }),
          });

          const emailResult = await emailResponse.text();
          console.log("Email send result:", emailResponse.status, emailResult);
        } catch (emailErr) {
          // Log but don't fail - the message is already saved in DB
          console.error("Email send error:", emailErr);
        }
      } else {
        console.log("LOVABLE_API_KEY not configured, skipping email notification");
      }
    } else {
      console.log("CONTACT_EMAIL not configured, skipping email notification. Message saved to database.");
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing contact form:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process contact form" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
