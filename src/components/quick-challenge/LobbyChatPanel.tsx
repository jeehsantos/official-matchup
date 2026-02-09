import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Users, CheckCircle2, FileText, Send } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useLobbyChatMessages, LobbyChatMessage } from "@/hooks/useLobbyChatMessages";

interface LobbyChatPanelProps {
  challengeId: string;
  currentUserId: string;
  totalSlots: number;
  filledSlots: number;
  isMatchFull: boolean;
  courtRules?: string | null;
}

export function LobbyChatPanel({
  challengeId,
  currentUserId,
  totalSlots,
  filledSlots,
  isMatchFull,
  courtRules,
}: LobbyChatPanelProps) {
  const { messages, isLoading, sendMessage, isSending } = useLobbyChatMessages(challengeId);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isSending) return;
    sendMessage(trimmed);
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-40 md:h-32 border-t flex shrink-0 relative z-30 bg-card border-border">
      {/* Chat Section (Left) */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border/50">
        {/* Messages Area */}
        <ScrollArea className="flex-1 px-3 py-2" ref={scrollRef}>
          <div className="space-y-1">
            {isLoading ? (
              <p className="text-[10px] text-muted-foreground italic">Loading chat...</p>
            ) : messages.length === 0 ? (
              <p className="text-[10px] text-muted-foreground italic">
                No messages yet. Say hello!
              </p>
            ) : (
              messages.map((msg) => (
                <ChatMessageRow
                  key={msg.id}
                  message={msg}
                  isCurrentUser={msg.sender_id === currentUserId}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="px-3 pb-2 pt-1">
          <div className="flex items-center gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message to the group..."
              className="h-8 text-xs bg-muted/50 border-border/50 focus-visible:ring-1"
              disabled={isSending}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isSending}
              className={cn(
                "p-1.5 rounded-full transition-colors",
                inputValue.trim()
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Status Section (Right) */}
      <div className="w-28 md:w-36 flex flex-col justify-center gap-2 p-3">
        {/* Player Count */}
        <div className="flex items-center gap-1.5 border px-2 py-1 rounded-full text-[8px] md:text-[9px] font-bold uppercase tracking-widest bg-muted border-border text-muted-foreground">
          <Users size={10} className="text-primary shrink-0" />
          <span className="text-primary font-bold">
            {filledSlots}/{totalSlots}
          </span>
          <span className="hidden md:inline">Players</span>
        </div>

        {/* Match Status */}
        {isMatchFull && (
          <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/30 px-2 py-1 rounded-full text-[8px] md:text-[9px] font-bold text-green-500 uppercase tracking-widest">
            <CheckCircle2 size={10} className="shrink-0" />
            <span className="truncate">Confirmed</span>
          </div>
        )}

        {/* Arena Rules Link */}
        {courtRules && (
          <button className="flex items-center gap-1.5 border px-2 py-1 rounded-full text-[8px] md:text-[9px] font-bold uppercase tracking-widest bg-muted/50 border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <FileText size={10} className="shrink-0" />
            <span className="truncate">Rules</span>
          </button>
        )}
      </div>
    </div>
  );
}

// Individual message row component
function ChatMessageRow({
  message,
  isCurrentUser,
}: {
  message: LobbyChatMessage;
  isCurrentUser: boolean;
}) {
  const isSystem = message.message_type === "system";

  if (isSystem) {
    return (
      <div className="flex items-start gap-1 text-[10px]">
        <span className="font-bold text-cyan-400 uppercase tracking-tight shrink-0">
          SYSTEM:
        </span>
        <span className="text-cyan-300/80">{message.content}</span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-1 text-[10px]">
      <span
        className={cn(
          "font-bold uppercase tracking-tight shrink-0",
          isCurrentUser ? "text-primary" : "text-amber-400"
        )}
      >
        {message.sender_name?.toUpperCase() || "PLAYER"}:
      </span>
      <span className="text-foreground/90 break-words">{message.content}</span>
    </div>
  );
}
