import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DollarSign,
  TrendingUp,
  Wallet,
  CreditCard,
  ArrowRightLeft,
  Clock,
  AlertTriangle,
  BarChart3,
  ShieldCheck,
  ShieldAlert,
  Settings,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";

interface FinancialSummary {
  summary: {
    gross_collected_total_cents: number;
    gross_collected_total_nzd: string;
    recipient_total_cents: number;
    recipient_total_nzd: string;
    service_fee_total_cents: number;
    service_fee_total_nzd: string;
    platform_fee_total_cents: number;
    platform_fee_total_nzd: string;
    stripe_fee_actual_total_cents: number;
    stripe_fee_actual_total_nzd: string;
    stripe_fee_coverage_cents: number;
    stripe_fee_coverage_nzd: string;
    transferred_to_courts_total_cents: number;
    transferred_to_courts_total_nzd: string;
    pending_court_payables_total_cents: number;
    pending_court_payables_total_nzd: string;
    credits_liability_total_cents: number;
    credits_liability_total_nzd: string;
    net_platform_position_cents: number;
    net_platform_position_nzd: string;
    true_net_profit_cents: number;
    true_net_profit_nzd: string;
    fee_health_status: "healthy" | "warning" | "critical";
  };
  breakdown: {
    session_payments: { count: number; gross_cents: number; recipient_cents: number; service_fee_cents: number };
    quick_challenge_payments: { count: number; gross_cents: number; recipient_cents: number; service_fee_cents: number };
  };
  top_venues: { venue_id: string; venue_name: string; total_cents: number; payment_count: number }[];
  daily_time_series: { date: string; gross_collected_cents: number; service_fee_cents: number; recipient_cents: number; payment_count: number }[];
  date_range: { start_date: string; end_date: string };
}

function FeeHealthBadge({ status }: { status: "healthy" | "warning" | "critical" }) {
  if (status === "healthy") {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10">
        <ShieldCheck className="h-3 w-3 mr-1" /> Healthy
      </Badge>
    );
  }
  if (status === "warning") {
    return (
      <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/10">
        <ShieldAlert className="h-3 w-3 mr-1" /> Warning
      </Badge>
    );
  }
  return (
    <Badge variant="destructive">
      <ShieldAlert className="h-3 w-3 mr-1" /> Critical
    </Badge>
  );
}

function AdminFinanceContent() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: platformSettings } = useQuery({
    queryKey: ["admin-platform-settings-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("player_fee, manager_fee_percentage, stripe_percent, stripe_fixed, is_active")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data, isLoading, error, refetch } = useQuery<FinancialSummary>({
    queryKey: ["admin-finance", startDate, endDate],
    queryFn: async () => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/get-admin-financial-summary?start_date=${startDate}&end_date=${endDate}`;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch financial summary");
      return response.json();
    },
  });

  const s = data?.summary;

  const summaryCards = s ? [
    { label: "Gross Collected", value: `$${s.gross_collected_total_nzd}`, icon: DollarSign, color: "text-emerald-600" },
    { label: "Court Payables (Pending)", value: `$${s.pending_court_payables_total_nzd}`, icon: Clock, color: "text-amber-600" },
    { label: "Transferred to Courts", value: `$${s.transferred_to_courts_total_nzd}`, icon: ArrowRightLeft, color: "text-blue-600" },
    { label: "Service Fees Earned", value: `$${s.service_fee_total_nzd}`, icon: TrendingUp, color: "text-emerald-600" },
    { label: "Stripe Fees (Actual)", value: `$${s.stripe_fee_actual_total_nzd}`, icon: CreditCard, color: "text-muted-foreground" },
    { label: "True Net Profit", value: `$${s.true_net_profit_nzd}`, icon: Wallet, color: Number(s.true_net_profit_nzd) >= 0 ? "text-emerald-600" : "text-destructive" },
    { label: "Credits Liability", value: `$${s.credits_liability_total_nzd}`, icon: AlertTriangle, color: "text-destructive" },
    { label: "Net Platform Position", value: `$${s.net_platform_position_nzd}`, icon: BarChart3, color: "text-primary" },
  ] : [];

  return (
    <AdminLayout title="Financial Dashboard">
      <div className="space-y-6">
        {/* Current Fee Configuration */}
        {platformSettings && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="h-4 w-4 text-primary" />
                Current Fee Configuration
              </CardTitle>
              <CardDescription>Active settings used for new payments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Player Fee</p>
                  <p className="text-lg font-semibold">${Number(platformSettings.player_fee).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Manager Commission</p>
                  <p className="text-lg font-semibold">{Number(platformSettings.manager_fee_percentage)}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Stripe Rate</p>
                  <p className="text-lg font-semibold">{(Number(platformSettings.stripe_percent) * 100).toFixed(1)}% + ${Number(platformSettings.stripe_fixed).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge className={platformSettings.is_active ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10" : "bg-destructive/10 text-destructive"}>
                    {platformSettings.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Date Range Picker */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <Label htmlFor="start-date" className="text-sm">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div>
                <Label htmlFor="end-date" className="text-sm">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <Button onClick={() => refetch()} variant="outline" size="sm">
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="border-destructive">
            <CardContent className="p-6 text-center text-destructive">
              Failed to load financial data. Please try again.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Fee Health Warning */}
            {s && s.fee_health_status !== "healthy" && (
              <Card className={s.fee_health_status === "critical" ? "border-destructive bg-destructive/5" : "border-amber-500 bg-amber-500/5"}>
                <CardContent className="p-4 flex items-start gap-3">
                  <AlertTriangle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${s.fee_health_status === "critical" ? "text-destructive" : "text-amber-600"}`} />
                  <div>
                    <p className="font-semibold text-sm">
                      {s.fee_health_status === "critical" ? "Stripe Fee Coverage Deficit" : "Stripe Fee Coverage Marginal"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Actual Stripe fees (${s.stripe_fee_actual_total_nzd}) {s.fee_health_status === "critical" ? "exceed" : "are close to"} estimated coverage (${s.stripe_fee_coverage_nzd}).
                      Consider increasing the Stripe rate in Platform Fees settings.
                    </p>
                  </div>
                  <FeeHealthBadge status={s.fee_health_status} />
                </CardContent>
              </Card>
            )}

            {/* Platform Health Card */}
            {s && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldCheck className="h-4 w-4" />
                    Platform Fee Health
                    <FeeHealthBadge status={s.fee_health_status} />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Service Fees Collected</p>
                      <p className="text-xl font-bold">${s.service_fee_total_nzd}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Actual Stripe Fees</p>
                      <p className="text-xl font-bold text-muted-foreground">${s.stripe_fee_actual_total_nzd}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">True Net Profit</p>
                      <p className={`text-xl font-bold ${Number(s.true_net_profit_nzd) >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        ${s.true_net_profit_nzd}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {summaryCards.map((card) => (
                <Card key={card.label}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <card.icon className={`h-4 w-4 ${card.color}`} />
                      <span className="text-xs text-muted-foreground">{card.label}</span>
                    </div>
                    <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Payment Type Breakdown */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Session Payments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Count</span><span className="font-medium">{data?.breakdown.session_payments.count}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Gross</span><span className="font-medium">${((data?.breakdown.session_payments.gross_cents || 0) / 100).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Court Share</span><span className="font-medium">${((data?.breakdown.session_payments.recipient_cents || 0) / 100).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Service Fees</span><span className="font-medium">${((data?.breakdown.session_payments.service_fee_cents || 0) / 100).toFixed(2)}</span></div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Quick Challenge Payments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Count</span><span className="font-medium">{data?.breakdown.quick_challenge_payments.count}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Gross</span><span className="font-medium">${((data?.breakdown.quick_challenge_payments.gross_cents || 0) / 100).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Court Share</span><span className="font-medium">${((data?.breakdown.quick_challenge_payments.recipient_cents || 0) / 100).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Service Fees</span><span className="font-medium">${((data?.breakdown.quick_challenge_payments.service_fee_cents || 0) / 100).toFixed(2)}</span></div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Top Venues */}
            {data?.top_venues && data.top_venues.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Top Venues by Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Venue</TableHead>
                        <TableHead className="text-right">Payments</TableHead>
                        <TableHead className="text-right">Court Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.top_venues.map((v) => (
                        <TableRow key={v.venue_id}>
                          <TableCell className="font-medium">{v.venue_name}</TableCell>
                          <TableCell className="text-right">{v.payment_count}</TableCell>
                          <TableCell className="text-right">${(v.total_cents / 100).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Daily Time Series */}
            {data?.daily_time_series && data.daily_time_series.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Daily Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Payments</TableHead>
                          <TableHead className="text-right">Gross</TableHead>
                          <TableHead className="text-right">Court Share</TableHead>
                          <TableHead className="text-right">Service Fee</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.daily_time_series.map((d) => (
                          <TableRow key={d.date}>
                            <TableCell className="font-medium">{d.date}</TableCell>
                            <TableCell className="text-right">{d.payment_count}</TableCell>
                            <TableCell className="text-right">${(d.gross_collected_cents / 100).toFixed(2)}</TableCell>
                            <TableCell className="text-right">${(d.recipient_cents / 100).toFixed(2)}</TableCell>
                            <TableCell className="text-right">${(d.service_fee_cents / 100).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}

export default function AdminFinance() {
  return (
    <ProtectedRoute requiredRole="admin">
      <AdminFinanceContent />
    </ProtectedRoute>
  );
}