import { useState } from "react";
import { Bell, Check, CheckCheck, CreditCard, Users, Calendar, AlertTriangle, Gift, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth-context";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const typeIcons: Record<string, typeof Bell> = {
  game_reminder: Calendar,
  payment_due: CreditCard,
  payment_confirmed: Check,
  rescue_mode: AlertTriangle,
  slot_released: AlertTriangle,
  player_joined: UserPlus,
  group_invite: Gift,
  session_cancelled: AlertTriangle,
};

const typeColors: Record<string, string> = {
  game_reminder: "text-primary bg-primary/10",
  payment_due: "text-warning bg-warning/10",
  payment_confirmed: "text-success bg-success/10",
  rescue_mode: "text-warning bg-warning/10",
  slot_released: "text-destructive bg-destructive/10",
  player_joined: "text-primary bg-primary/10",
  group_invite: "text-accent bg-accent/10",
  session_cancelled: "text-destructive bg-destructive/10",
};

function NotificationItem({
  notification,
  onRead,
}: {
  notification: Notification;
  onRead: (id: string) => void;
}) {
  const Icon = typeIcons[notification.type] || Bell;
  const colorClass = typeColors[notification.type] || "text-muted-foreground bg-muted";

  return (
    <button
      onClick={() => !notification.is_read && onRead(notification.id)}
      className={cn(
        "w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-muted/50 border-b border-border/50 last:border-0",
        !notification.is_read && "bg-primary/5"
      )}
    >
      <div className={cn("p-2 rounded-lg shrink-0 mt-0.5", colorClass)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm font-medium line-clamp-1", !notification.is_read && "font-semibold")}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>
    </button>
  );
}

export function NotificationDropdown() {
  const { user } = useAuth();
  const { data: notifications = [], unreadCount, markAsRead, markAllAsRead, isLoading } = useNotifications(user?.id);
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-destructive text-destructive-foreground rounded-full text-[10px] font-bold">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[360px] p-0 rounded-2xl overflow-hidden"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-display font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-primary h-7 gap-1.5"
              onClick={markAllAsRead}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        {/* List */}
        <ScrollArea className="max-h-[400px]">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <Bell className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">No notifications yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                We'll notify you about games and payments
              </p>
            </div>
          ) : (
            notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onRead={markAsRead}
              />
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
