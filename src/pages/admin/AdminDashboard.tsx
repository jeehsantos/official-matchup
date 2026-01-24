import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Settings, 
  Layers, 
  Activity,
  ArrowLeft,
  Shield,
  Archive
} from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MobileLayout } from "@/components/layout/MobileLayout";

function AdminDashboardContent() {
  const navigate = useNavigate();

  const menuItems = [
    {
      title: "Sport Categories",
      description: "Manage available sport types for courts and groups",
      icon: Activity,
      href: "/admin/sports",
    },
    {
      title: "Surface Types",
      description: "Manage court surface types (Grass, Turf, Clay, etc.)",
      icon: Layers,
      href: "/admin/surfaces",
    },
    {
      title: "Data Archiving",
      description: "Monitor and manage data archiving and cleanup tasks",
      icon: Archive,
      href: "/admin/archiving",
    },
  ];

  return (
    <MobileLayout showHeader={false} showBottomNav={false}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="flex items-center gap-4 p-4 max-w-4xl mx-auto">
            <Button variant="ghost" size="icon" onClick={() => navigate("/games")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h1 className="font-display font-semibold text-xl">Admin Dashboard</h1>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-6 max-w-4xl mx-auto">
          {/* Overview Card */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
                  <Settings className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold">System Configuration</h2>
                  <p className="text-muted-foreground">
                    Manage global settings and lookup tables
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Menu Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {menuItems.map((item) => (
              <Card
                key={item.href}
                className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
                onClick={() => navigate(item.href)}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{item.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{item.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}

export default function AdminDashboard() {
  return (
    <ProtectedRoute requiredRole="admin">
      <AdminDashboardContent />
    </ProtectedRoute>
  );
}
