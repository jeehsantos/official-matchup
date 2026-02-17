import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EquipmentSelector, type SelectedEquipment } from "@/components/booking/EquipmentSelector";
import { usePlatformFee } from "@/hooks/usePlatformFee";
import { estimateServiceFee } from "@/lib/utils";
import { toast } from "sonner";
import { 
  FileText, 
  CreditCard, 
  ChevronLeft, 
  ChevronRight,
  Loader2,
  Calendar,
  Clock,
  MapPin,
  DollarSign,
  Package,
  Users,
  CheckCircle2
} from "lucide-react";
import type { Equipment } from "@/hooks/useVenueEquipment";

type BookingPaymentType = "single" | "split";

interface QuickChallengeWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: {
    paymentType: BookingPaymentType;
    equipment: SelectedEquipment[];
  }) => void;
  courtPrice: number;
  startTime: string;
  endTime: string;
  slotDate: string;
  courtName: string;
  venueName: string;
  venueAddress: string;
  courtRules: string | null;
  equipment: Equipment[];
  selectedEquipment: SelectedEquipment[];
  onEquipmentChange: (equipment: SelectedEquipment[]) => void;
  paymentTiming: "at_booking" | "before_session" | null;
  sportName: string;
  gameMode: string;
  totalPlayers: number;
  submitting?: boolean;
}

const STEPS = [
  { id: 1, title: "Terms & Rules", icon: FileText },
  { id: 2, title: "Equipment", icon: Package },
  { id: 3, title: "Payment", icon: CreditCard },
];

export function QuickChallengeWizard({
  open,
  onOpenChange,
  onConfirm,
  courtPrice,
  startTime,
  endTime,
  slotDate,
  courtName,
  venueName,
  venueAddress,
  courtRules,
  equipment,
  selectedEquipment,
  onEquipmentChange,
  paymentTiming,
  sportName,
  gameMode,
  totalPlayers,
  submitting = false,
}: QuickChallengeWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [paymentType, setPaymentType] = useState<BookingPaymentType>("split");
  const { playerFee: platformFee } = usePlatformFee();

  // Reset state when modal opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setCurrentStep(1);
      setRulesAccepted(false);
      setPaymentType("split");
    }
    onOpenChange(isOpen);
  };

  const handleNext = () => {
    if (currentStep === 1 && !rulesAccepted) {
      toast.error("Please accept the terms and rules to continue");
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, 3));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleConfirm = () => {
    if (!rulesAccepted) {
      toast.error("You must accept the court rules before booking");
      setCurrentStep(1);
      return;
    }
    onConfirm({
      paymentType,
      equipment: selectedEquipment,
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { 
      weekday: "long",
      month: "short", 
      day: "numeric" 
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const equipmentTotal = selectedEquipment.reduce(
    (sum, item) => sum + item.quantity * item.pricePerUnit, 
    0
  );
  const totalPrice = courtPrice + equipmentTotal;
  const pricePerPlayer = Math.ceil((totalPrice / totalPlayers) * 100) / 100;
  const perPlayerServiceFee = estimateServiceFee(pricePerPlayer, platformFee);
  const perPlayerTotal = pricePerPlayer + perPlayerServiceFee;
  const totalWithFees = totalPrice + estimateServiceFee(totalPrice, platformFee);

  const progress = (currentStep / STEPS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100vw-16px)] sm:w-[calc(100vw-32px)] max-w-md sm:max-w-lg h-[calc(100dvh-100px)] sm:h-[85dvh] sm:max-h-[700px] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header with progress */}
        <div className="sticky top-0 z-10 bg-background border-b border-border p-3 sm:p-4">
          <DialogHeader className="mb-3 sm:mb-4">
            <DialogTitle className="text-lg sm:text-xl truncate pr-6">Quick Challenge</DialogTitle>
          </DialogHeader>
          
          {/* Progress bar */}
          <Progress value={progress} className="h-1.5 sm:h-2 mb-2 sm:mb-3" />
          
          {/* Step indicators */}
          <div className="flex justify-between">
            {STEPS.map((step) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              
              return (
                <div 
                  key={step.id}
                  className={`flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm ${
                    isActive 
                      ? "text-primary font-medium" 
                      : isCompleted 
                        ? "text-primary/70" 
                        : "text-muted-foreground"
                  }`}
                >
                  <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center shrink-0 ${
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : isCompleted 
                        ? "bg-primary/20 text-primary" 
                        : "bg-muted text-muted-foreground"
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4" />
                    ) : (
                      <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    )}
                  </div>
                  <span className="hidden sm:inline">{step.title}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-3 sm:p-4 space-y-4 sm:space-y-5">
          {/* Booking Summary - Always visible */}
          <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-base sm:text-lg truncate">{sportName} - {gameMode}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{courtName} at {venueName}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
              <div className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="truncate">{formatDate(slotDate)}</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="truncate">{formatTime(startTime)} - {formatTime(endTime)}</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="truncate">{totalPlayers} players</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 font-semibold text-primary">
                <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <div className="text-right">
                  <span className="text-base sm:text-lg">${totalWithFees.toFixed(2)}</span>
                  <p className="text-[10px] sm:text-xs font-normal text-muted-foreground">
                    ${perPlayerTotal.toFixed(2)}/player
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Step 1: Terms & Rules */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Court Rules & Guidelines
                </h4>
                
                {courtRules ? (
                  <div className="bg-muted/50 rounded-xl p-4 text-sm text-muted-foreground whitespace-pre-wrap border border-border max-h-48 overflow-y-auto">
                    {courtRules}
                  </div>
                ) : (
                  <div className="bg-muted/50 rounded-xl p-4 text-sm text-muted-foreground border border-border">
                    <p>General venue guidelines apply:</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Arrive 10 minutes before your booking time</li>
                      <li>Wear appropriate sports attire and footwear</li>
                      <li>Respect other players and venue staff</li>
                      <li>No food or drinks on the court</li>
                      <li>Report any damages or issues immediately</li>
                    </ul>
                  </div>
                )}

                <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <Checkbox 
                    id="rules-accepted" 
                    checked={rulesAccepted}
                    onCheckedChange={(checked) => setRulesAccepted(checked === true)}
                    className="mt-0.5"
                  />
                  <Label htmlFor="rules-accepted" className="text-sm leading-relaxed cursor-pointer">
                    I have read and agree to the court rules and guidelines. I understand that failure to comply may result in booking cancellation.
                  </Label>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Equipment */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {equipment.length > 0 ? (
                <EquipmentSelector
                  equipment={equipment}
                  selectedEquipment={selectedEquipment}
                  onSelectionChange={onEquipmentChange}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No equipment available for rental at this venue.</p>
                  <p className="text-sm mt-1">You can proceed to the next step.</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Payment */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Payment Method
                </h4>
                
                <RadioGroup
                  value={paymentType}
                  onValueChange={(val) => setPaymentType(val as BookingPaymentType)}
                  className="space-y-3"
                >
                  <div className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
                    paymentType === "single" 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  }`}>
                    <RadioGroupItem value="single" id="single" className="mt-1" />
                    <Label htmlFor="single" className="flex-1 cursor-pointer">
                      <span className="font-medium">Pay Full Amount</span>
                      <p className="text-sm text-muted-foreground mt-1">
                        You pay the entire court fee (${totalWithFees.toFixed(2)}) upfront. Other players join for free.
                      </p>
                    </Label>
                  </div>
                  
                  <div className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
                    paymentType === "split" 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  }`}>
                    <RadioGroupItem value="split" id="split" className="mt-1" />
                    <Label htmlFor="split" className="flex-1 cursor-pointer">
                      <span className="font-medium">Split Between Players</span>
                      <p className="text-sm text-muted-foreground mt-1">
                        Each player pays ${perPlayerTotal.toFixed(2)} (incl. service fee) when they join ({totalPlayers} players total).
                      </p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Price Summary */}
              <div className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Court Fee</span>
                  <span>${courtPrice.toFixed(2)}</span>
                </div>
                {equipmentTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Equipment</span>
                    <span>${equipmentTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Service fee (per player)</span>
                  <span>${perPlayerServiceFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold pt-2 border-t border-border">
                  <span>Total</span>
                  <span className="text-primary">${totalWithFees.toFixed(2)}</span>
                </div>
                {paymentType === "split" && (
                  <div className="flex justify-between text-sm text-muted-foreground pt-1">
                    <span>Per Player (incl. service fee)</span>
                    <span>${perPlayerTotal.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer with navigation */}
        <div className="sticky bottom-0 z-10 bg-background border-t border-border p-3 sm:p-4" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <div className="flex gap-3">
            {currentStep > 1 ? (
              <Button 
                variant="outline" 
                onClick={handleBack}
                className="flex-1 h-10 sm:h-12"
                disabled={submitting}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            ) : (
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="flex-1 h-10 sm:h-12"
                disabled={submitting}
              >
                Cancel
              </Button>
            )}
            
            {currentStep < 3 ? (
              <Button 
                onClick={handleNext}
                className="flex-1 h-10 sm:h-12"
              >
                Continue
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button 
                onClick={handleConfirm}
                disabled={submitting}
                className="flex-1 h-10 sm:h-12"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Create Challenge
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
