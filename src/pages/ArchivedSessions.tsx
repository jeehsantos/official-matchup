import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Archive, Calendar, MapPin, DollarSign } from "lucide-react";
import { toast } from "sonner";

interface ArchivedSession {
  id: string;
  session_date: string;
  sport_type: string;
  court_name: string;
  venue_name: string;
  amount_paid: number;
}

export default function ArchivedSessions() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ArchivedSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadArchivedSessions();
    }
  }, [user]);

  const loadArchivedSessions = async () => {
    if (!user) return;

    try {
      setLoading(true);
      // Note: This function needs to be created via migration
      // For now, return empty array if the function doesn't exist
      const { data, error } = await supabase
        .from("session_players")
        .select(`
          id,
          sessions!inner (
            id,
            session_date,
            group_id,
            court_id,
            groups!inner (sport_type),
            courts (name, venues (name))
          ),
          payments (amount)
        `)
        .eq("user_id", user.id)
        .lt("sessions.session_date", new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
        .limit(50);

      if (error) throw error;

      const formattedSessions: ArchivedSession[] = (data || []).map((item: any) => ({
        id: item.sessions?.id || item.id,
        session_date: item.sessions?.session_date || "",
        sport_type: item.sessions?.groups?.sport_type || "other",
        court_name: item.sessions?.courts?.name || "Unknown Court",
        venue_name: item.sessions?.courts?.venues?.name || "Unknown Venue",
        amount_paid: item.payments?.[0]?.amount || 0,
      }));

      setSessions(formattedSessions);
    } catch (error) {
      console.error("Error loading archived sessions:", error);
      // Silently fail - feature may not be fully available yet
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NZ", {
      style: "currency",
      currency: "NZD",
    }).format(amount);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <MobileLayout>
      <div className="px-4 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive className="h-6 w-6 text-primary" />
            <h1 className="font-display text-2xl font-bold">Archived Sessions</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/profile")}>
            Back
          </Button>
        </div>

        {/* Info Card */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              These are your sessions from more than 2 years ago. They are stored in our
              archive for your records.
            </p>
          </CardContent>
        </Card>

        {/* Sessions List */}
        {sessions.length > 0 ? (
          <div className="space-y-3">
            {sessions.map((session) => (
              <Card key={session.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span className="capitalize">{session.sport_type}</span>
                    {session.amount_paid > 0 && (
                      <span className="text-sm font-normal text-muted-foreground">
                        {formatCurrency(session.amount_paid)}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(session.session_date)}</span>
                  </div>
                  {session.venue_name && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>
                        {session.court_name} at {session.venue_name}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <Archive className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-display font-semibold text-lg mb-2">
                No Archived Sessions
              </h3>
              <p className="text-muted-foreground text-sm">
                You don't have any archived sessions yet. Sessions older than 2 years will
                appear here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </MobileLayout>
  );
}
