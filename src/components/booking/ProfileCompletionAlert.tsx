import { AlertCircle, ArrowRight, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface ProfileCompletionAlertProps {
  missingFields: string[];
  onClose?: () => void;
}

export function ProfileCompletionAlert({ missingFields, onClose }: ProfileCompletionAlertProps) {
  const navigate = useNavigate();

  const handleCompleteProfile = () => {
    onClose?.();
    navigate("/profile/edit");
  };

  return (
    <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-600/5 p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
          <User className="h-5 w-5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-foreground flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            Complete Your Profile
          </h4>
          <p className="text-sm text-muted-foreground mt-1">
            Please complete your profile before booking a court. This helps other players know who they're playing with.
          </p>
        </div>
      </div>

      <div className="bg-background/50 rounded-lg p-3">
        <p className="text-xs font-medium text-muted-foreground mb-2">Missing information:</p>
        <div className="flex flex-wrap gap-2">
          {missingFields.map((field) => (
            <span
              key={field}
              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-700 dark:text-amber-400"
            >
              {field}
            </span>
          ))}
        </div>
      </div>

      <Button 
        onClick={handleCompleteProfile}
        className="w-full bg-amber-500 hover:bg-amber-600 text-white"
      >
        Complete Profile
        <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
    </div>
  );
}
