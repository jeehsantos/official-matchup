import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Settings,
  CreditCard,
  Bell,
  Shield,
  LogOut,
  ChevronRight,
  User,
  Building2,
} from "lucide-react";

export default function Profile() {
  const { user, isLoading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, isLoading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const menuItems = [
    {
      icon: User,
      label: "Edit Profile",
      description: "Update your personal info",
      path: "/profile/edit",
    },
    {
      icon: Building2,
      label: "Become a Court Manager",
      description: "List your venue",
      path: "/become-manager",
    },
    {
      icon: CreditCard,
      label: "Payment Methods",
      description: "Manage your cards",
      path: "/profile/payments",
    },
    {
      icon: Bell,
      label: "Notifications",
      description: "Customize alerts",
      path: "/profile/notifications",
    },
    {
      icon: Shield,
      label: "Privacy & Security",
      description: "Account settings",
      path: "/profile/security",
    },
    {
      icon: Settings,
      label: "Settings",
      description: "App preferences",
      path: "/profile/settings",
    },
  ];

  const userInitials = user.email?.charAt(0).toUpperCase() || "U";

  return (
    <MobileLayout>
      <div className="px-4 py-4 space-y-6">
        {/* Profile header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user.user_metadata?.avatar_url} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xl font-display font-bold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="font-display font-bold text-lg truncate">
                  {user.user_metadata?.full_name || "Player"}
                </h2>
                <p className="text-muted-foreground text-sm truncate">
                  {user.email}
                </p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="secondary" className="text-xs">
                    Player
                  </Badge>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border">
              <div className="text-center">
                <p className="font-display font-bold text-xl">12</p>
                <p className="text-xs text-muted-foreground">Games Played</p>
              </div>
              <div className="text-center">
                <p className="font-display font-bold text-xl">3</p>
                <p className="text-xs text-muted-foreground">Groups</p>
              </div>
              <div className="text-center">
                <p className="font-display font-bold text-xl">100%</p>
                <p className="text-xs text-muted-foreground">Show Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Menu items */}
        <Card>
          <CardContent className="p-0">
            {menuItems.map((item, index) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors ${
                  index !== menuItems.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.description}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Sign out button */}
        <Button
          variant="outline"
          className="w-full text-destructive hover:text-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </MobileLayout>
  );
}