import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ManagerLayout } from "@/components/layout/ManagerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  Building2
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Venue {
  id: string;
  name: string;
  stripe_account_id: string | null;
}

interface ConnectStatus {
  connected: boolean;
  details_submitted: boolean;
  payouts_enabled: boolean;
  charges_enabled: boolean;
  account_id?: string;
}

export default function ManagerSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>("");
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchVenues();
    }
  }, [user]);

  useEffect(() => {
    if (selectedVenueId) {
      checkConnectStatus();
    }
  }, [selectedVenueId]);

  useEffect(() => {
    // Handle return from Stripe onboarding
    if (searchParams.get("success") === "true") {
      toast({
        title: "Stripe Connected!",
        description: "Your account has been connected successfully.",
      });
      if (selectedVenueId) {
        checkConnectStatus();
      }
    }
    if (searchParams.get("refresh") === "true") {
      toast({
        title: "Onboarding Incomplete",
        description: "Please complete the Stripe onboarding process.",
        variant: "destructive",
      });
    }
  }, [searchParams]);

  const fetchVenues = async () => {
    try {
      const { data, error } = await supabase
        .from("venues")
        .select("id, name, stripe_account_id")
        .eq("owner_id", user!.id);

      if (error) throw error;

      // Type assertion since we know the structure
      const venueData = data as unknown as Venue[];
      setVenues(venueData || []);
      
      if (venueData && venueData.length > 0) {
        setSelectedVenueId(venueData[0].id);
      }
    } catch (error) {
      console.error("Error fetching venues:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkConnectStatus = async () => {
    if (!selectedVenueId) return;

    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-status", {
        body: { venueId: selectedVenueId },
      });

      if (error) throw error;
      setConnectStatus(data);
    } catch (error) {
      console.error("Error checking connect status:", error);
      setConnectStatus(null);
    }
  };

  const handleConnectStripe = async () => {
    if (!selectedVenueId) return;

    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-onboard", {
        body: { 
          venueId: selectedVenueId,
          origin: window.location.origin,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error starting onboarding:", error);
      toast({
        title: "Error",
        description: "Failed to start Stripe onboarding. Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenDashboard = async () => {
    if (!selectedVenueId) return;

    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-dashboard", {
        body: { venueId: selectedVenueId },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Error opening dashboard:", error);
      toast({
        title: "Error",
        description: "Failed to open Stripe dashboard.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <ManagerLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your payment settings and account</p>
        </div>

        {venues.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No Venues Yet</h3>
              <p className="text-muted-foreground">
                Create a venue first to configure payment settings.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Venue Selector */}
            {venues.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Select Venue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a venue" />
                    </SelectTrigger>
                    <SelectContent>
                      {venues.map((venue) => (
                        <SelectItem key={venue.id} value={venue.id}>
                          {venue.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            )}

            {/* Stripe Connect Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Payouts
                </CardTitle>
                <CardDescription>
                  Connect your Stripe account to receive payments directly to your bank account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status Display */}
                {connectStatus?.connected ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="font-medium">Stripe Account Connected</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Details Submitted:</span>
                        <Badge variant={connectStatus.details_submitted ? "default" : "secondary"}>
                          {connectStatus.details_submitted ? "Complete" : "Pending"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Payments:</span>
                        <Badge variant={connectStatus.charges_enabled ? "default" : "secondary"}>
                          {connectStatus.charges_enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Payouts:</span>
                        <Badge variant={connectStatus.payouts_enabled ? "default" : "secondary"}>
                          {connectStatus.payouts_enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                    </div>

                    {!connectStatus.details_submitted && (
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-yellow-800 dark:text-yellow-200">
                            Complete Your Setup
                          </p>
                          <p className="text-sm text-yellow-700 dark:text-yellow-300">
                            Your Stripe account setup is incomplete. Click below to continue.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3">
                      {!connectStatus.details_submitted && (
                        <Button onClick={handleConnectStripe} disabled={actionLoading}>
                          {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Continue Setup
                        </Button>
                      )}
                      {connectStatus.details_submitted && (
                        <Button onClick={handleOpenDashboard} disabled={actionLoading}>
                          {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open Stripe Dashboard
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="font-medium mb-2">Why connect Stripe?</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Receive court booking payments directly to your bank</li>
                        <li>• Automatic payouts with transparent fee structure</li>
                        <li>• View earnings and manage payouts from Stripe dashboard</li>
                      </ul>
                    </div>

                    <Button onClick={handleConnectStripe} disabled={actionLoading}>
                      {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      <CreditCard className="h-4 w-4 mr-2" />
                      Connect Stripe Account
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </ManagerLayout>
  );
}
