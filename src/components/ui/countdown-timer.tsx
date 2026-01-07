import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  deadline: Date;
  className?: string;
  onExpire?: () => void;
}

function calculateTimeLeft(deadline: Date) {
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    expired: false,
  };
}

export function CountdownTimer({
  deadline,
  className,
  onExpire,
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft(deadline));

  useEffect(() => {
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft(deadline);
      setTimeLeft(newTimeLeft);

      if (newTimeLeft.expired) {
        clearInterval(timer);
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [deadline, onExpire]);

  const isUrgent = timeLeft.days === 0 && timeLeft.hours < 6;

  if (timeLeft.expired) {
    return (
      <div className={cn("text-destructive font-semibold text-sm", className)}>
        Deadline passed
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm",
        isUrgent ? "text-warning" : "text-muted-foreground",
        className
      )}
    >
      <Clock className={cn("h-4 w-4", isUrgent && "animate-pulse-soft")} />
      <span className="font-medium">
        {timeLeft.days > 0 && `${timeLeft.days}d `}
        {String(timeLeft.hours).padStart(2, "0")}:
        {String(timeLeft.minutes).padStart(2, "0")}:
        {String(timeLeft.seconds).padStart(2, "0")}
      </span>
      <span className="text-muted-foreground">to pay</span>
    </div>
  );
}