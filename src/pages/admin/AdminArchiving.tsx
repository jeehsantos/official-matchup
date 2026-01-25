import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Archive, Play, RefreshCw, Database } from "lucide-react";
import { toast } from "sonner";

interface ArchivingLog {
  id: string;
  task_name: string;
  records_processed: number;
  execution_time: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface TableSize {
  table_name: string;
  total_size: string;
  table_size: string;
  indexes_size: string;
  row_count: number;
  dead_rows: number;
}

export default function AdminArchiving() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<ArchivingLog[]>([]);
  const [tableSizes, setTableSizes] = useState<TableSize[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Note: These tables don't exist yet - they need to be created via migration
      // For now, we'll use empty arrays to prevent errors
      setLogs([]);
      setTableSizes([]);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load archiving data");
    } finally {
      setLoading(false);
    }
  };

  const runArchivingTasks = async () => {
    try {
      setRunning(true);
      toast.info("Starting archiving tasks...");

      const { data, error } = await supabase.functions.invoke("run-archiving-tasks", {
        method: "POST",
      });

      if (error) throw error;

      toast.success("Archiving tasks completed successfully");
      await loadData(); // Reload data
    } catch (error) {
      console.error("Error running archiving tasks:", error);
      toast.error("Failed to run archiving tasks");
    } finally {
      setRunning(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (interval: string) => {
    // Parse PostgreSQL interval format
    const match = interval.match(/(\d+):(\d+):(\d+\.?\d*)/);
    if (!match) return interval;

    const hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const seconds = parseFloat(match[3]);

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds.toFixed(1)}s`;
    return `${seconds.toFixed(2)}s`;
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
            <h1 className="font-display text-2xl font-bold">Data Archiving</h1>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading || running}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={runArchivingTasks}
              disabled={running}
              className="btn-athletic"
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-1" />
                  Run Now
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Info Card */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              Archiving tasks automatically move old data to archive tables to keep the
              database fast. Tasks run monthly, but you can trigger them manually here.
            </p>
          </CardContent>
        </Card>

        {/* Table Sizes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database Table Sizes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Table</TableHead>
                    <TableHead>Rows</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Indexes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableSizes.map((table) => (
                    <TableRow key={table.table_name}>
                      <TableCell className="font-mono text-xs">
                        {table.table_name}
                      </TableCell>
                      <TableCell>{table.row_count.toLocaleString()}</TableCell>
                      <TableCell>{table.table_size}</TableCell>
                      <TableCell>{table.indexes_size}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Archiving Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Archiving Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Records</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length > 0 ? (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">
                          {log.task_name}
                        </TableCell>
                        <TableCell>{log.records_processed.toLocaleString()}</TableCell>
                        <TableCell>{formatDuration(log.execution_time)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              log.status === "SUCCESS" ? "default" : "destructive"
                            }
                          >
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(log.created_at)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No archiving jobs have been run yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
}
