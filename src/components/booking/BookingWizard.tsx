import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { SportIcon, getSportLabel } from "@/components/ui/sport-icon";
import { PaymentTypeSelector } from "@/components/booking/PaymentTypeSelector";
import { EquipmentSelector, type SelectedEquipment } from "@/components/booking/EquipmentSelector";
import { useSportCategories } from "@/hooks/useSportCategories";
import { usePlatformFee } from "@/hooks/usePlatformFee";
import { estimateServiceFee } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { 
  FileText, 
  Users, 
  CreditCard, 
  ChevronLeft, 
  ChevronRight,
  Loader2,
  Calendar,
  Clock,
  MapPin,
  DollarSign,
  Plus,
  Package,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Group = Database["public"]["Tables"]["groups"]["Row"];
type SportType = Database["public"]["Enums"]["sport_type"];
type BookingPaymentType = "single" | "split";

import type { Equipment } from "@/hooks/useVenueEquipment";

interface BookingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: {
    groupId: string;
    isNewGroup: boolean;
    paymentType: BookingPaymentType;
    equipment: SelectedEquipment[];
    sportCategoryId: string;
    splitPlayers?: number;
  }) => void;
  sportType: SportType;
  courtPrice: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  city: string;
  slotDate: string;
  courtName: string;
  venueName: string;
  venueAddress: string;
  courtRules: string | null;
  equipment: Equipment[];
  selectedEquipment: SelectedEquipment[];
  onEquipmentChange: (equipment: SelectedEquipment[]) => void;
  paymentTiming: "at_booking" | "before_session" | null;
}

const STEPS = [
  { id: 1, title: "Terms & Rules", icon: FileText },
  { id: 2, title: "Session Config", icon: Users },
  { id: 3, title: "Payment", icon: CreditCard },
];

export function BookingWizard({
  open,
  onOpenChange,
  onConfirm,
  sportType,
  courtPrice,
  dayOfWeek,
  startTime,
  endTime,
  city,
  slotDate,
  courtName,
  venueName,
  venueAddress,
  courtRules,
  equipment,
  selectedEquipment,
  onEquipmentChange,
  paymentTiming,
}: BookingWizardProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  
  // Step 2: Session Configuration
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedSportCategoryId, setSelectedSportCategoryId] = useState<string>("");
  // Step 3: Payment
  const [paymentType, setPaymentType] = useState<BookingPaymentType>("single");
  const [splitPlayers, setSplitPlayers] = useState(6);
  const [submitting, setSubmitting] = useState(false);
  
  // Fetch sport categories from database
  const { data: sportCategories = [], isLoading: loadingSports } = useSportCategories();
  
  // Fetch admin-configured platform fee (read-only display)
  const { playerFee: platformFee } = usePlatformFee();

  const isNewGroup = selectedGroupId === "new";

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setCurrentStep(1);
      setRulesAccepted(false);
      setSelectedGroupId("");
      setNewGroupName("");
      setSelectedSportCategoryId("");
      setPaymentType("single");
      setSplitPlayers(6);
      fetchUserGroups();
    }
  }, [open]);
  
  // Auto-select first sport category when loaded
  useEffect(() => {
    if (sportCategories.length > 0 && !selectedSportCategoryId) {
      setSelectedSportCategoryId(sportCategories[0].id);
    }
  }, [sportCategories, selectedSportCategoryId]);

  const fetchUserGroups = async () => {
    if (!user) return;
    
    setLoadingGroups(true);
    try {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .eq("organizer_id", user.id)
        .eq("is_active", true);

      if (error) throw error;
      setUserGroups(data || []);
      
      // Auto-select if only one group exists
      if (data && data.length === 1) {
        setSelectedGroupId(data[0].id);
      } else if (!data || data.length === 0) {
        setSelectedGroupId("new");
      }
    } catch (error) {
      console.error("Error fetching groups:", error);
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!rulesAccepted) {
        toast.error("Please accept the terms and rules to continue");
        return;
      }
    }
    if (currentStep === 2) {
      if (isNewGroup && !newGroupName.trim()) {
        toast.error("Please enter a name for your new group");
        return;
      }
      if (!selectedGroupId) {
        toast.error("Please select or create a group");
        return;
      }
    }
    setCurrentStep(prev => Math.min(prev + 1, 3));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleConfirm = async () => {
    // Safety check: ensure rules were accepted
    if (!rulesAccepted) {
      toast.error("You must accept the court rules before booking");
      setCurrentStep(1);
      return;
    }

    setSubmitting(true);
    try {
      if (isNewGroup) {
        // Create new group
        const { data, error } = await supabase
          .from("groups")
          .insert({
            name: newGroupName.trim(),
            organizer_id: user!.id,
            sport_type: sportType,
            city: city,
            default_day_of_week: dayOfWeek,
            default_start_time: startTime,
            weekly_court_price: courtPrice,
            is_public: false,
          })
          .select()
          .single();

        if (error) throw error;
        
        // Add organizer as group member
        await supabase.from("group_members").insert({
          group_id: data.id,
          user_id: user!.id,
          is_admin: true,
        });

        onConfirm({
          groupId: data.id,
          isNewGroup: true,
          paymentType,
          equipment: selectedEquipment,
          sportCategoryId: selectedSportCategoryId,
          splitPlayers: paymentType === "split" ? splitPlayers : undefined,
        });
      } else {
        onConfirm({
          groupId: selectedGroupId,
          isNewGroup: false,
          paymentType,
          equipment: selectedEquipment,
          sportCategoryId: selectedSportCategoryId,
          splitPlayers: paymentType === "split" ? splitPlayers : undefined,
        });
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
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

  // Calculate equipment total
  const equipmentTotal = selectedEquipment.reduce(
    (sum, item) => sum + item.quantity * item.pricePerUnit, 
    0
  );
  const courtTotal = courtPrice + equipmentTotal;
  // Service fee includes platform fee + estimated Stripe processing fee (display only, backend is authoritative)
  const serviceFee = estimateServiceFee(courtTotal, platformFee);
  const totalPrice = courtTotal + serviceFee;
  const perPlayerPrice = paymentType === "split" && splitPlayers > 0
    ? Math.ceil((courtTotal / splitPlayers) * 100) / 100
    : null;
  const perPlayerServiceFee = perPlayerPrice !== null
    ? estimateServiceFee(perPlayerPrice, platformFee)
    : null;
  const perPlayerTotal = perPlayerPrice !== null && perPlayerServiceFee !== null
    ? perPlayerPrice + perPlayerServiceFee
    : null;

  const progress = (currentStep / STEPS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-16px)] sm:w-[calc(100vw-32px)] max-w-md sm:max-w-lg h-[calc(100dvh-165px)] sm:h-auto sm:max-h-[78dvh] flex flex-col p-0 gap-0">
        {/* Header with progress */}
        <div className="sticky top-0 z-10 bg-background border-b border-border p-3 sm:p-4">
          <DialogHeader className="mb-3 sm:mb-4">
            <DialogTitle className="text-lg sm:text-xl truncate pr-6">Book {courtName}</DialogTitle>
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
          {/* Venue Summary - Always visible */}
          <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
              <SportIcon sport={sportType} className="h-8 w-8 sm:h-10 sm:w-10 shrink-0" />
              <div className="min-w-0">
                <h3 className="font-semibold text-base sm:text-lg truncate">{courtName}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{venueName}</p>
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
                <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="truncate">{city}</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 font-semibold text-primary">
                <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <div className="text-right">
                  <span className="text-base sm:text-lg">${totalPrice.toFixed(2)}</span>
                  {perPlayerTotal !== null && (
                    <p className="text-[10px] sm:text-xs font-normal text-muted-foreground">
                      ${perPlayerTotal.toFixed(2)}/player
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Step 1: Terms & Rules */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Payment Timing Alert */}
              {paymentTiming === "at_booking" && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-amber-900 dark:text-amber-100">Payment Required at Booking</p>
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      This court requires full payment at the time of booking. You'll need to pay the complete amount to confirm your reservation.
                    </p>
                  </div>
                </div>
              )}

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

          {/* Step 2: Session Configuration */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Group Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Select Group
                </Label>
                
                {loadingGroups ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading your groups...
                  </div>
                ) : (
                  <Select
                    value={selectedGroupId}
                    onValueChange={setSelectedGroupId}
                  >
                    <SelectTrigger className="w-full h-12">
                      <SelectValue placeholder="Choose a group..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border border-border shadow-lg">
                      {userGroups.map((group) => (
                        <SelectItem key={group.id} value={group.id} className="py-3">
                          <div className="flex items-center gap-2">
                            <SportIcon sport={group.sport_type} className="h-4 w-4" />
                            <span>{group.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                      <SelectItem value="new" className="py-3">
                        <div className="flex items-center gap-2 text-primary">
                          <Plus className="h-4 w-4" />
                          <span className="font-medium">Create New Group</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {isNewGroup && (
                  <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                    <Input
                      placeholder="Enter group name (e.g., Wednesday Legends)"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      className="h-12"
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      You'll be the organizer. Invite players after booking.
                    </p>
                  </div>
                )}
              </div>

              {/* Sport Category Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <SportIcon sport={sportType} className="h-4 w-4" />
                  Sport Category
                </Label>
                
                {loadingSports ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading categories...
                  </div>
                ) : (
                  <Select
                    value={selectedSportCategoryId}
                    onValueChange={setSelectedSportCategoryId}
                  >
                    <SelectTrigger className="w-full h-12">
                      <SelectValue placeholder="Choose a sport category..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border border-border shadow-lg">
                      {sportCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id} className="py-3">
                          <div className="flex items-center gap-2">
                            {category.icon && <span>{category.icon}</span>}
                            <span>{category.display_name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Equipment Rental */}
              {equipment.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Equipment Rental (Optional)
                  </Label>
                  <EquipmentSelector
                    equipment={equipment}
                    selectedEquipment={selectedEquipment}
                    onSelectionChange={onEquipmentChange}
                    disabled={submitting}
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 3: Payment & Finalization */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Rules confirmation check */}
              {!rulesAccepted && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-medium">Rules not accepted</p>
                    <p className="text-sm">Please go back and accept the court rules first.</p>
                  </div>
                </div>
              )}

              {/* Price Summary */}
              <div className="space-y-3">
                <h4 className="font-semibold">Booking Summary</h4>
              <div className="bg-muted/50 rounded-xl p-4 border border-border space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Court rental</span>
                    <span>${courtPrice.toFixed(2)}</span>
                  </div>
                  {selectedEquipment.map(item => (
                    <div key={item.equipmentId} className="flex justify-between text-sm text-muted-foreground">
                      <span>{item.name} × {item.quantity}</span>
                      <span>${(item.quantity * item.pricePerUnit).toFixed(2)}</span>
                    </div>
                  ))}
                  {serviceFee > 0 && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Service fee</span>
                      <span>${serviceFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-border pt-2 mt-2">
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Total</span>
                      <span className="text-primary">${totalPrice.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Type Selection */}
              <PaymentTypeSelector
                paymentType={paymentType}
                onPaymentTypeChange={(type) => {
                  setPaymentType(type);
                  if (type === "single") setSplitPlayers(6);
                }}
                courtPrice={totalPrice}
                paymentTiming={paymentTiming}
              />

              {/* Number of players - only when split is selected */}
              {paymentType === "split" && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Number of Players
                  </Label>
                  <Input
                    type="number"
                    min={2}
                    value={splitPlayers}
                    onChange={(e) => setSplitPlayers(Math.max(2, Number(e.target.value)))}
                    className="h-12"
                  />
                  <p className="text-xs text-muted-foreground">
                    This sets the minimum players required. Each player pays their share to confirm.
                  </p>
                  {perPlayerTotal !== null && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Court share per player</span>
                        <span>${perPlayerPrice!.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Service fee per player</span>
                        <span>${perPlayerServiceFee!.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-sm border-t border-primary/20 pt-1 mt-1">
                        <span>Total per player</span>
                        <span className="text-primary">${perPlayerTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Group info */}
              {selectedGroupId && selectedGroupId !== "new" && (
                <div className="text-sm text-muted-foreground">
                  <span>Booking for: </span>
                  <span className="font-medium text-foreground">
                    {userGroups.find(g => g.id === selectedGroupId)?.name}
                  </span>
                </div>
              )}
              {isNewGroup && newGroupName && (
                <div className="text-sm text-muted-foreground">
                  <span>Creating new group: </span>
                  <span className="font-medium text-foreground">{newGroupName}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with navigation - always visible */}
        <div 
          className="shrink-0 bg-background border-t border-border p-3 sm:p-4 flex gap-2 sm:gap-3"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
        >
          {currentStep > 1 ? (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={submitting}
              className="flex-1 h-11 sm:h-12 text-sm sm:text-base min-w-0"
            >
              <ChevronLeft className="h-4 w-4 mr-1 shrink-0" />
              <span className="truncate">Back</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="flex-1 h-11 sm:h-12 text-sm sm:text-base min-w-0"
            >
              <span className="truncate">Cancel</span>
            </Button>
          )}
          
          {currentStep < 3 ? (
            <Button
              onClick={handleNext}
              className="flex-1 h-11 sm:h-12 text-sm sm:text-base min-w-0"
              disabled={currentStep === 1 && !rulesAccepted}
            >
              <span className="truncate">Continue</span>
              <ChevronRight className="h-4 w-4 ml-1 shrink-0" />
            </Button>
          ) : (
            <Button
              onClick={handleConfirm}
              disabled={submitting || !rulesAccepted}
              className="flex-1 h-11 sm:h-12 text-sm sm:text-base min-w-0"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5 shrink-0" />
                  <span className="truncate">Processing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-1.5 shrink-0" />
                  <span className="truncate">Confirm</span>
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
