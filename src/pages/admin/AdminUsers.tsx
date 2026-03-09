import { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, Edit, CheckCircle, ShieldAlert, Ban } from "lucide-react";
import { format } from "date-fns";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserData {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  full_name: string;
  role: AppRole;
  banned_until: string | null;
}

const isUserBanned = (user: UserData) => {
  return user.banned_until && new Date(user.banned_until) > new Date();
};

const getUserStatus = (user: UserData): { label: string; variant: "default" | "secondary" | "destructive" } => {
  if (isUserBanned(user)) return { label: "Disabled", variant: "destructive" };
  if (user.email_confirmed_at) return { label: "Active", variant: "default" };
  return { label: "Unconfirmed", variant: "secondary" };
};

export default function AdminUsers() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editRole, setEditRole] = useState<AppRole>("player");
  const [isUpdating, setIsUpdating] = useState(false);
  
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "list", search: searchQuery, page, perPage: 50 },
      });

      if (error) throw error;
      
      setUsers(data.users);
      setTotal(data.total);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error fetching users",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleActivate = async (userId: string) => {
    try {
      const { error } = await supabase.functions.invoke("manage-users", {
        body: { action: "activate", userId },
      });

      if (error) throw error;

      toast({
        title: "User activated",
        description: "The user has been activated and can now sign in.",
      });
      
      setUsers(users.map(u => u.id === userId ? { ...u, email_confirmed_at: new Date().toISOString(), banned_until: null } : u));
    } catch (error: any) {
      toast({
        title: "Failed to activate user",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeactivate = async (userId: string) => {
    try {
      const { error } = await supabase.functions.invoke("manage-users", {
        body: { action: "deactivate", userId },
      });

      if (error) throw error;

      toast({
        title: "User disabled",
        description: "The user has been disabled and can no longer sign in.",
      });
      
      setUsers(users.map(u => u.id === userId ? { ...u, banned_until: new Date(Date.now() + 876000 * 3600000).toISOString() } : u));
    } catch (error: any) {
      toast({
        title: "Failed to disable user",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditClick = (user: UserData) => {
    setEditingUser(user);
    setEditFullName(user.full_name);
    setEditRole(user.role);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    
    setIsUpdating(true);
    try {
      const { error } = await supabase.functions.invoke("manage-users", {
        body: { 
          action: "update", 
          userId: editingUser.id,
          full_name: editFullName,
          role: editRole
        },
      });

      if (error) throw error;

      toast({
        title: "User updated",
        description: "User profile and role have been updated.",
      });
      
      setUsers(users.map(u => u.id === editingUser.id ? { ...u, full_name: editFullName, role: editRole } : u));
      setEditingUser(null);
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <ProtectedRoute requiredRole="admin">
      <AdminLayout title="User Management">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Users ({total})</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="flex gap-2 mb-6">
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-sm"
                />
                <Button type="submit" variant="secondary">
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </form>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          Loading users...
                        </TableCell>
                      </TableRow>
                    ) : users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          No users found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{user.full_name || 'No Name'}</span>
                              <span className="text-sm text-muted-foreground">{user.email}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'}>
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const status = getUserStatus(user);
                              return (
                                <Badge variant={status.variant}>
                                  {status.label}
                                </Badge>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {format(new Date(user.created_at), 'MMM d, yyyy')}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {(!user.email_confirmed_at || isUserBanned(user)) && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleActivate(user.id)}
                                  title="Activate user (confirm email + unban)"
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Activate
                                </Button>
                              )}
                              {user.email_confirmed_at && !isUserBanned(user) && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="text-destructive border-destructive/50 hover:bg-destructive/10"
                                  onClick={() => handleDeactivate(user.id)}
                                  title="Disable user (prevent sign-in)"
                                >
                                  <Ban className="h-4 w-4 mr-1" />
                                  Disable
                                </Button>
                              )}
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleEditClick(user)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              
              <div className="flex justify-between items-center mt-4">
                <span className="text-sm text-muted-foreground">
                  Showing {users.length} of {total} users
                </span>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={users.length < 50}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User: {editingUser?.email}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input 
                  value={editFullName} 
                  onChange={(e) => setEditFullName(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={editRole} onValueChange={(val: AppRole) => setEditRole(val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="player">Player</SelectItem>
                    <SelectItem value="organizer">Organizer</SelectItem>
                    <SelectItem value="court_manager">Court Manager</SelectItem>
                    <SelectItem value="venue_staff">Venue Staff</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                {editRole === 'admin' && (
                  <p className="text-xs text-destructive flex items-center mt-1">
                    <ShieldAlert className="h-3 w-3 mr-1" />
                    Warning: Giving admin access grants full control over the system.
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={isUpdating}>
                {isUpdating ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AdminLayout>
    </ProtectedRoute>
  );
}