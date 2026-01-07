import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { GroupCard } from "@/components/cards/GroupCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

// Demo data
const myGroups = [
  {
    id: "1",
    name: "Wednesday Legends",
    sport: "futsal" as const,
    city: "Auckland",
    memberCount: 18,
    schedule: "Wednesdays at 7:00 PM",
    isPublic: false,
  },
  {
    id: "2",
    name: "Sunday Smashers",
    sport: "badminton" as const,
    city: "North Shore",
    memberCount: 12,
    schedule: "Sundays at 2:00 PM",
    isPublic: true,
  },
  {
    id: "3",
    name: "Hoops After Work",
    sport: "basketball" as const,
    city: "Albany",
    memberCount: 15,
    schedule: "Thursdays at 6:30 PM",
    isPublic: true,
  },
];

export default function Groups() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
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
          <h1 className="font-display text-2xl font-bold">My Groups</h1>
          <Link to="/groups/create">
            <Button size="sm" className="btn-athletic">
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </Link>
        </div>

        {/* Groups list */}
        {myGroups.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {myGroups.map((group) => (
              <GroupCard key={group.id} {...group} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Plus className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-lg mb-2">
                No groups yet
              </h3>
              <p className="text-muted-foreground text-sm mb-4">
                Create your first group to start organizing weekly games
              </p>
              <Link to="/groups/create">
                <Button className="btn-athletic">
                  Create a Group
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </MobileLayout>
  );
}