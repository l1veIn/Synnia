import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
  isTyping?: boolean;
}

interface ChatInterfaceProps {
  // nodeId: string; // Removed as per refactor
  onSendMessage: () => Promise<void>;
  messages: Message[];
  isProcessing: boolean;
}

export function ChatInterface({ onSendMessage, messages, isProcessing }: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isProcessing]);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;
    // const content = input; // Unused now
    await onSendMessage(); 
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 pb-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3 text-sm",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}
            >
              <Avatar className="h-8 w-8 border">
                <AvatarFallback className={msg.role === 'agent' ? "bg-primary/10 text-primary" : "bg-muted"}>
                  {msg.role === 'agent' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
              
              <div className={cn(
                "rounded-lg px-3 py-2 max-w-[85%] break-words",
                msg.role === 'user' 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-foreground"
              )}>
                {msg.content}
              </div>
            </div>
          ))}
          
          {isProcessing && (
            <div className="flex gap-3 text-sm">
               <Avatar className="h-8 w-8 border">
                <AvatarFallback className="bg-primary/10 text-primary"><Bot className="h-4 w-4" /></AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-lg px-3 py-2 flex items-center">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t border-border/50 bg-background/50 backdrop-blur supports-[backdrop-filter]:bg-background/50">
        <div className="flex gap-2">
          <Input
            placeholder="Ask agent to generate..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
            className="flex-1"
          />
          <Button size="icon" onClick={handleSend} disabled={!input.trim() || isProcessing}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
