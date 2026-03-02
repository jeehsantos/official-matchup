import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import { format, subDays } from "date-fns";

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
  };
  breakdown: {
    session_payments: { count: number; gross_cents: number; recipient_cents: number; service_fee_cents: number };
    quick_challenge_payments: { count: number; gross_cents: number; recipient_cents: number; service_fee_cents: number };
  };
  top_venues: { venue_id: string; venue_name: string; total_cents: number; payment_count: number }[];
  daily_time_series: { date: string; gross_collected_cents: number; service_fee_cents: number; recipient_cents: number; payment_count: number }[];
  date_range: { start_date: string; end_date: string };
}

function AdminFinanceContent() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data, isLoading, error, refetch } = useQuery<FinancialSummary>({
    queryKey: ["admin-finance", startDate, endDate],
    queryFn: async () => {
      const { data: result, error } = await supabase.functions.invoke("get-admin-financial-summary", {
        method: "GET",
        headers: {},
        body: undefined,
      });
      // The function uses query params, so we need to call it differently
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
    { label: "Platform Fees (Our Share)", value: `$${s.platform_fee_total_nzd}`, icon: Wallet, color: "text-primary" },
    { label: "Stripe Fee Coverage", value: `$${s.stripe_fee_coverage_nzd}`, icon: CreditCard, color: "text-muted-foreground" },
    { label: "Credits Liability", value: `$${s.credits_liability_total_nzd}`, icon: AlertTriangle, color: "text-destructive" },
    { label: "Net Platform Position", value: `$${s.net_platform_position_nzd}`, icon: BarChart3, color: "text-primary" },
  ] : [];

  return (
    <AdminLayout title="Financial Dashboard">
      <div className="space-y-6">
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
