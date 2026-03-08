import { Loader2 } from "lucide-react";

interface BookingProcessingOverlayProps {
  visible: boolean;
  message?: string;
}

export function BookingProcessingOverlay({ visible, message = "Processing your booking..." }: BookingProcessingOverlayProps) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-card border border-border shadow-lg max-w-xs text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-medium text-foreground">{message}</p>
        <p className="text-xs text-muted-foreground">Please don't close this page</p>
      </div>
    </div>
  );
}
