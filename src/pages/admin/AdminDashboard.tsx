import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Settings, 
  Layers, 
  Activity,
  Shield,
  Archive,
  Gift,
  DollarSign,
  BarChart3,
  Globe,
  Users
} from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/AdminLayout";

function AdminDashboardContent() {
  const navigate = useNavigate();

  const menuItems = [
    {
      title: "User Management",
      description: "Manage users, activate accounts, and change roles",
      icon: Users,
      href: "/admin/users",
    },
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
    {
      title: "Referral Program",
      description: "Configure referral credit amount and view stats",
      icon: Gift,
      href: "/admin/referrals",
    },
    {
      title: "Platform Fees",
      description: "Configure commission fees for players and managers",
      icon: DollarSign,
      href: "/admin/fees",
    },
    {
      title: "Financial Dashboard",
      description: "View revenue, court payables, and platform position",
      icon: BarChart3,
      href: "/admin/finance",
    },
    {
      title: "Venue Pages",
      description: "Manage public venue page slugs and shareable URLs",
      icon: Globe,
      href: "/admin/venues",
    },
  ];

  return (
    <AdminLayout title="Admin Dashboard">
      <div className="space-y-6">
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
    </AdminLayout>
  );
}

export default function AdminDashboard() {
  return (
    <ProtectedRoute requiredRole="admin">
      <AdminDashboardContent />
    </ProtectedRoute>
  );
}
