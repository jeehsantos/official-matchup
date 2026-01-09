import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SportIcon, getSportLabel } from "@/components/ui/sport-icon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  Clock, 
  Users,
  Share2,
  Crown,
  UserPlus,
  CalendarDays,
  Copy,
  Link as LinkIcon,
  Settings
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Group = Database["public"]["Tables"]["groups"]["Row"];
type Session = Database["public"]["Tables"]["sessions"]["Row"];
type GroupMember = Database["public"]["Tables"]["group_members"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Court = Database["public"]["Tables"]["courts"]["Row"];
type Venue = Database["public"]["Tables"]["venues"]["Row"];

interface MemberWithProfile extends GroupMember {
  profile?: Profile;
}

interface SessionWithDetails extends Session {
  courts?: Court & { venues?: Venue };
  playerCount?: number;
  userJoined?: boolean;
}

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (id && user) {
      fetchGroup();
    }
  }, [id, user]);

  const fetchGroup = async () => {
    if (!id || !user) return;

    setLoading(true);
    try {
      // Fetch group
      const { data: groupData, error: groupError } = await supabase
        .from("groups")
        .select("*")
        .eq("id", id)
        .single();

      if (groupError) throw groupError;
      setGroup(groupData);
      setIsOrganizer(groupData.organizer_id === user.id);

      // Fetch members with profiles
      const { data: membersData } = await supabase
        .from("group_members")
        .select("*")
        .eq("group_id", id);

      const membersWithProfiles = await Promise.all(
        (membersData || []).map(async (member) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", member.user_id)
            .single();
          return { ...member, profile };
        })
      );

      setMembers(membersWithProfiles);
      setIsMember(membersWithProfiles.some(m => m.user_id === user.id) || groupData.organizer_id === user.id);

      // Fetch sessions
      const { data: sessionsData } = await supabase
        .from("sessions")
        .select(`
          *,
          courts (
            *,
            venues (*)
          )
        `)
        .eq("group_id", id)
        .eq("is_cancelled", false)
        .gte("session_date", new Date().toISOString().split("T")[0])
        .order("session_date", { ascending: true });

      const sessionsWithCounts = await Promise.all(
        (sessionsData || []).map(async (session) => {
          const { count } = await supabase
            .from("session_players")
            .select("*", { count: "exact", head: true })
            .eq("session_id", session.id);
          
          // Check if current user is in this session
          const { data: playerData } = await supabase
            .from("session_players")
            .select("id")
            .eq("session_id", session.id)
            .eq("user_id", user.id)
            .maybeSingle();
          
          return { ...session, playerCount: count || 0, userJoined: !!playerData };
        })
      );

      setSessions(sessionsWithCounts);

      // Fetch existing invite link if organizer
      if (groupData.organizer_id === user.id && !groupData.is_public) {
        const { data: invitation } = await supabase
          .from("group_invitations")
          .select("invite_code")
          .eq("group_id", id)
          .eq("is_active", true)
          .maybeSingle();

        if (invitation) {
          setInviteLink(`${window.location.origin}/join/${invitation.invite_code}`);
        }
      }
    } catch (error) {
      console.error("Error fetching group:", error);
      navigate("/groups");
    } finally {
      setLoading(false);
    }
  };

  const toggleGroupVisibility = async () => {
    if (!group || !isOrganizer) return;

    try {
      const { error } = await supabase
        .from("groups")
        .update({ is_public: !group.is_public })
        .eq("id", group.id);

      if (error) throw error;
      setGroup({ ...group, is_public: !group.is_public });
      toast({
        title: group.is_public ? "Group is now private" : "Group is now public",
        description: group.is_public 
          ? "Only invited members can join" 
          : "Anyone can find and join this group",
      });
    } catch (error) {
      console.error("Error updating group:", error);
    }
  };

  const generateInviteLink = async () => {
    if (!group || !isOrganizer) return;

    setGeneratingLink(true);
    try {
      // Generate a random invite code
      const inviteCode = crypto.randomUUID().split("-")[0];

      const { error } = await supabase
        .from("group_invitations")
        .insert({
          group_id: group.id,
          invite_code: inviteCode,
          created_by: user!.id,
        });

      if (error) throw error;

      const link = `${window.location.origin}/join/${inviteCode}`;
      setInviteLink(link);
      
      toast({
        title: "Invite link created!",
        description: "Share this link with players you want to invite.",
      });
    } catch (error) {
      console.error("Error generating invite link:", error);
      toast({
        title: "Error",
        description: "Failed to generate invite link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyInviteLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      toast({
        title: "Link copied!",
        description: "Share it with players you want to invite.",
      });
    }
  };

  const joinGroup = async () => {
    if (!group || !user) return;

    try {
      const { error } = await supabase
        .from("group_members")
        .insert({
          group_id: group.id,
          user_id: user.id,
          is_admin: false,
        });

      if (error) throw error;
      setIsMember(true);
      fetchGroup();
      
      toast({
        title: "Joined group!",
        description: `You're now a member of ${group.name}.`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to join",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const promoteMember = async (memberId: string, userId: string) => {
    if (!group || !isOrganizer) return;

    try {
      const { error } = await supabase
        .from("group_members")
        .update({ is_admin: true })
        .eq("id", memberId);

      if (error) throw error;
      
      // Update local state
      setMembers(members.map(m => 
        m.id === memberId ? { ...m, is_admin: true } : m
      ));
      
      toast({
        title: "Member promoted!",
        description: "They are now a co-organizer of this group.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to promote member",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  if (!group) {
    return (
      <MobileLayout>
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <h2 className="text-xl font-semibold mb-2">Group not found</h2>
          <p className="text-muted-foreground mb-4">This group doesn't exist or has been removed.</p>
          <Button onClick={() => navigate("/groups")}>Back to Groups</Button>
        </div>
      </MobileLayout>
    );
  }

  const admins = members.filter(m => m.is_admin);
  const regularMembers = members.filter(m => !m.is_admin);

  return (
    <MobileLayout showHeader={false} showBottomNav={false}>
      <div className="min-h-screen bg-background">
        {/* Header Image */}
        <div className="relative h-48 lg:h-64 bg-gradient-to-br from-primary/30 to-primary/10">
          {group.photo_url && (
            <img
              src={group.photo_url}
              alt={group.name}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
          
          {/* Back button */}
          <div className="absolute top-4 left-4 right-4 flex justify-between">
            <Button variant="secondary" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Button variant="secondary" size="icon">
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-4 max-w-4xl mx-auto lg:p-6 lg:space-y-6 -mt-16 relative">
          {/* Group Header Card */}
          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <SportIcon sport={group.sport_type} size="lg" />
                  <div>
                    <h1 className="font-display text-xl lg:text-2xl font-bold">{group.name}</h1>
                    <p className="text-muted-foreground">{getSportLabel(group.sport_type)}</p>
                  </div>
                </div>
                <Badge variant={group.is_public ? "secondary" : "outline"}>
                  {group.is_public ? "Public Group" : "Private Group"}
                </Badge>
              </div>
              
              {group.description && (
                <p className="mt-4 text-muted-foreground">{group.description}</p>
              )}

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{members.length + 1}</p>
                  <p className="text-xs text-muted-foreground">Members</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">${group.weekly_court_price}</p>
                  <p className="text-xs text-muted-foreground">Per Session</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{sessions.length}</p>
                  <p className="text-xs text-muted-foreground">Upcoming</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Organizer Controls */}
          {isOrganizer && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                  <Settings className="h-4 w-4" />
                  Group Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-4">
                {/* Privacy Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="public-toggle">Public Group</Label>
                    <p className="text-xs text-muted-foreground">
                      {group.is_public 
                        ? "Anyone can find and join" 
                        : "Only invited members can join"}
                    </p>
                  </div>
                  <Switch
                    id="public-toggle"
                    checked={group.is_public || false}
                    onCheckedChange={toggleGroupVisibility}
                  />
                </div>

                {/* Invite Link (for private groups) */}
                {!group.is_public && (
                  <div className="pt-2 border-t space-y-3">
                    <div className="flex items-center gap-2">
                      <LinkIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Invite Link</span>
                    </div>
                    
                    {inviteLink ? (
                      <div className="flex gap-2">
                        <div className="flex-1 px-3 py-2 bg-muted rounded-md text-sm truncate">
                          {inviteLink}
                        </div>
                        <Button size="sm" variant="outline" onClick={copyInviteLink}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={generateInviteLink}
                        disabled={generatingLink}
                      >
                        {generatingLink ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <LinkIcon className="h-4 w-4 mr-2" />
                        )}
                        Generate Invite Link
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Schedule Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="p-4 lg:p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Regular Schedule</p>
                    <p className="font-semibold">
                      {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][group.default_day_of_week]}s at {group.default_start_time.slice(0, 5)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 lg:p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-semibold">{group.city}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs for Sessions and Members */}
          <Tabs defaultValue="sessions" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sessions">
                <CalendarDays className="h-4 w-4 mr-2" />
                Sessions
              </TabsTrigger>
              <TabsTrigger value="members">
                <Users className="h-4 w-4 mr-2" />
                Members
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sessions" className="mt-4 space-y-3">
              {sessions.length > 0 ? (
                sessions.map((session) => {
                  const court = session.courts as (Court & { venues?: Venue }) | undefined;
                  const isUserInSession = session.userJoined || isOrganizer;
                  return (
                    <Card 
                      key={session.id} 
                      className="hover:shadow-card-hover transition-shadow cursor-pointer"
                      onClick={() => navigate(`/games/${session.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-semibold">
                                {format(new Date(session.session_date), "EEEE, MMM d")}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {session.start_time.slice(0, 5)}
                              </span>
                              {court && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {court.name}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-semibold">
                                ${(session.court_price / session.min_players).toFixed(2)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {session.playerCount}/{session.max_players} players
                              </p>
                            </div>
                            <Button 
                              size="sm" 
                              variant={isUserInSession ? "outline" : "default"}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/games/${session.id}`);
                              }}
                            >
                              {isUserInSession ? "View" : "Join"}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No upcoming sessions scheduled</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="members" className="mt-4 space-y-4">
              {/* Organizer */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                    <Crown className="h-4 w-4 text-warning" />
                    Organizer
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/5 border border-warning/20">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-warning/20 text-warning font-semibold">
                        {isOrganizer ? user.email?.charAt(0).toUpperCase() : "O"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {isOrganizer ? "You" : "Organizer"}
                      </p>
                    </div>
                    <Crown className="h-4 w-4 text-warning" />
                  </div>
                </CardContent>
              </Card>

              {/* Co-Organizers */}
              {admins.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                      <Crown className="h-4 w-4 text-primary" />
                      Co-Organizers ({admins.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {admins.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20"
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={member.profile?.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                              {member.profile?.full_name?.charAt(0) || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {member.profile?.full_name || "Member"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Joined {format(new Date(member.joined_at), "MMM yyyy")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Regular Members */}
              {regularMembers.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      Members ({regularMembers.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {regularMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={member.profile?.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                              {member.profile?.full_name?.charAt(0) || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {member.profile?.full_name || "Member"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Joined {format(new Date(member.joined_at), "MMM yyyy")}
                            </p>
                          </div>
                          {isOrganizer && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2"
                              onClick={() => promoteMember(member.id, member.user_id)}
                            >
                              <Crown className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          {/* Join Button */}
          {!isMember && group.is_public && (
            <div className="sticky bottom-4 pb-4">
              <Button 
                className="w-full btn-athletic h-12 text-base"
                onClick={joinGroup}
              >
                <UserPlus className="h-5 w-5 mr-2" />
                Join Group - ${group.weekly_court_price}/session
              </Button>
            </div>
          )}
        </div>
      </div>
    </MobileLayout>
  );
}
