import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Check, Copy, ExternalLink, Loader2, Wand2, X } from "lucide-react";

function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isValidSlug(slug: string) {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

function AdminVenueSlugsContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: venues, isLoading } = useQuery({
    queryKey: ["admin-venues-slugs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venues")
        .select("id, name, slug, city, is_active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const updateSlug = useMutation({
    mutationFn: async ({ id, slug }: { id: string; slug: string | null }) => {
      const { error } = await supabase
        .from("venues")
        .update({ slug })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-venues-slugs"] });
      toast({ title: "Slug updated" });
      setEditingId(null);
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message?.includes("duplicate")
          ? "This slug is already taken"
          : err.message,
        variant: "destructive",
      });
    },
  });

  const startEdit = (venue: any) => {
    setEditingId(venue.id);
    setEditValue(venue.slug || "");
  };

  const handleSave = (id: string) => {
    const trimmed = editValue.trim();
    if (trimmed && !isValidSlug(trimmed)) {
      toast({
        title: "Invalid slug",
        description: "Use only lowercase letters, numbers, and hyphens",
        variant: "destructive",
      });
      return;
    }
    updateSlug.mutate({ id, slug: trimmed || null });
  };

  const handleCopy = async (slug: string, id: string) => {
    const url = `${window.location.origin}/venue/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <AdminLayout title="Venue Pages">
      <div className="space-y-4 max-w-3xl">
        <p className="text-muted-foreground">
          Manage public venue page slugs. Each venue with a slug gets a shareable landing page at{" "}
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/venue/slug</code>.
        </p>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {venues?.map((venue) => (
              <Card key={venue.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{venue.name}</h3>
                        <span className="text-xs text-muted-foreground">{venue.city}</span>
                        {!venue.is_active && (
                          <Badge variant="outline" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>

                      {editingId === venue.id ? (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-muted-foreground shrink-0">/venue/</span>
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value.toLowerCase())}
                            placeholder="venue-slug"
                            className="h-8 text-sm max-w-xs"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            onClick={() => setEditValue(toSlug(venue.name))}
                            title="Auto-generate"
                          >
                            <Wand2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => handleSave(venue.id)}
                            disabled={updateSlug.isPending}
                          >
                            {updateSlug.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-1">
                          {venue.slug ? (
                            <>
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                /venue/{venue.slug}
                              </code>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => handleCopy(venue.slug!, venue.id)}
                              >
                                {copiedId === venue.id ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                asChild
                              >
                                <a
                                  href={`/venue/${venue.slug}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">No slug set</span>
                          )}
                        </div>
                      )}
                    </div>

                    {editingId !== venue.id && (
                      <Button variant="outline" size="sm" onClick={() => startEdit(venue)}>
                        {venue.slug ? "Edit" : "Set Slug"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default function AdminVenueSlugs() {
  return (
    <ProtectedRoute requiredRole="admin">
      <AdminVenueSlugsContent />
    </ProtectedRoute>
  );
}
