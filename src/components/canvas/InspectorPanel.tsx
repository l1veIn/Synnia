import { useState, useEffect } from "react";
import { AssetNodeData } from "@/components/nodes/AssetNode";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, MessageSquare, History, Trash2, ChevronLeft } from "lucide-react";
import { Node } from "@xyflow/react";
import { ChatInterface, Message } from "./ChatInterface";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

interface InspectorPanelProps {
  node: Node<AssetNodeData> | null;
  onClose: () => void;
  onRefreshGraph: () => void; // Callback to refresh graph after agent action
}

export function InspectorPanel({ node, onClose, onRefreshGraph }: InspectorPanelProps) {
  const [mode, setMode] = useState<'details' | 'chat'>('details');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset state when node changes
  useEffect(() => {
      setMode('details');
      setMessages([]);
      setIsProcessing(false);
  }, [node?.id]);

  if (!node) return null;

  const { data } = node;

  const handleSendMessage = async (content: string) => {
      if (!node) return;
      
      // 1. Add User Message
      const userMsg: Message = {
          id: Date.now().toString(),
          role: 'user',
          content,
          timestamp: Date.now()
      };
      setMessages(prev => [...prev, userMsg]);
      setIsProcessing(true);

      try {
          // 2. Call Backend Mock Agent
          // For now, we simulate a delay and a hardcoded action
          // In future: await invoke('chat_with_agent', { nodeId: node.id, prompt: content })
          
          // Simulation:
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          let responseText = "I heard you, but I don't know how to do that yet.";
          
          // Mock Logic for Demo
          if (content.toLowerCase().includes("image") || content.toLowerCase().includes("picture")) {
              responseText = "Sure! I'm generating an image variant based on this node.";
              
              // Trigger a graph update (Mock)
              await invoke('create_node', { 
                  projectId: "demo", 
                  nodeType: "Image", 
                  x: node.position.x + 300, 
                  y: node.position.y 
              });
              
              // We need to link them too, but let's keep it simple for now or assume the backend did it.
              // In a real agent, the backend would return the ID of the new node, and we'd link it.
          } else if (content.toLowerCase().includes("text") || content.toLowerCase().includes("write")) {
              responseText = "Okay, drafting some text for you.";
               await invoke('create_node', { 
                  projectId: "demo", 
                  nodeType: "Text", 
                  x: node.position.x + 300, 
                  y: node.position.y + 100 
              });
          }

          const agentMsg: Message = {
              id: (Date.now() + 1).toString(),
              role: 'agent',
              content: responseText,
              timestamp: Date.now()
          };
          setMessages(prev => [...prev, agentMsg]);
          
          // Refresh the canvas to show new nodes
          onRefreshGraph();

      } catch (e) {
          toast.error(`Agent Error: ${e}`);
          setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'agent',
              content: "Sorry, something went wrong.",
              timestamp: Date.now()
          }]);
      } finally {
          setIsProcessing(false);
      }
  };

  return (
    <div className="absolute top-4 right-4 w-80 bottom-4 bg-background/95 backdrop-blur border border-border/60 shadow-2xl rounded-xl overflow-hidden flex flex-col z-20 animate-in slide-in-from-right-10 fade-in duration-200">
      {/* Header */}
      <div className="h-14 px-4 border-b border-border/50 flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2 overflow-hidden">
            {mode === 'chat' && (
                <Button variant="ghost" size="icon" className="h-6 w-6 -ml-2" onClick={() => setMode('details')}>
                    <ChevronLeft className="w-4 h-4" />
                </Button>
            )}
            <div className="font-semibold truncate pr-2">
            {mode === 'chat' ? `Chat: ${data.label.slice(0,8)}...` : data.label}
            </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Body Switcher */}
      {mode === 'chat' ? (
          <ChatInterface 
            nodeId={node.id} 
            messages={messages} 
            onSendMessage={handleSendMessage} 
            isProcessing={isProcessing} 
          />
      ) : (
        /* Details View */
        <div className="flex-1 overflow-hidden flex flex-col">
            <div className="p-4 pb-2">
                <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline" className="uppercase text-[10px]">{data.type}</Badge>
                <Badge className={
                    data.status === 'Active' ? "bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20" : 
                    "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border-yellow-500/20"
                }>
                    {data.status}
                </Badge>
                </div>
                
                <Button className="w-full gap-2" size="lg" onClick={() => setMode('chat')}>
                    <MessageSquare className="w-4 h-4" />
                    Chat with Agent
                </Button>
            </div>

            <Separator />

            <Tabs defaultValue="details" className="flex-1 flex flex-col">
                <div className="px-4 pt-2">
                    <TabsList className="w-full grid grid-cols-3">
                        <TabsTrigger value="details">Details</TabsTrigger>
                        <TabsTrigger value="history">History</TabsTrigger>
                        <TabsTrigger value="debug">Raw</TabsTrigger>
                    </TabsList>
                </div>
                
                <ScrollArea className="flex-1">
                    <TabsContent value="details" className="p-4 space-y-4 m-0">
                        <div className="space-y-1">
                            <span className="text-xs text-muted-foreground font-medium">Description</span>
                            <p className="text-sm leading-relaxed text-muted-foreground/80">
                                {data.preview || "No content available for this node."}
                            </p>
                        </div>
                        
                        <div className="space-y-1">
                            <span className="text-xs text-muted-foreground font-medium">Created At</span>
                            <p className="text-sm font-mono text-foreground">2023-10-27 10:30:00</p>
                        </div>

                        <div className="space-y-1">
                            <span className="text-xs text-muted-foreground font-medium">Dimensions / Specs</span>
                            <p className="text-sm font-mono text-foreground">1024x1024 • PNG</p>
                        </div>
                    </TabsContent>
                    
                    <TabsContent value="history" className="p-4 m-0">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                            <History className="w-4 h-4" />
                            <span>Version History</span>
                        </div>
                        <div className="border-l-2 border-muted ml-2 pl-4 space-y-6">
                            <div className="relative">
                                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-primary ring-4 ring-background" />
                                <p className="text-sm font-medium">Version 2 (Current)</p>
                                <p className="text-xs text-muted-foreground">Updated prompt by Agent</p>
                            </div>
                            <div className="relative opacity-50">
                                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-muted ring-4 ring-background" />
                                <p className="text-sm font-medium">Version 1</p>
                                <p className="text-xs text-muted-foreground">Original upload</p>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="debug" className="p-4 m-0">
                        <pre className="text-[10px] font-mono bg-muted p-2 rounded overflow-auto">
                            {JSON.stringify(data, null, 2)}
                        </pre>
                    </TabsContent>
                </ScrollArea>
            </Tabs>
        </div>
      )}

      {/* Footer Actions (Only in details mode) */}
      {mode === 'details' && (
        <div className="p-4 border-t border-border/50 bg-muted/10">
            <Button variant="destructive" variant="outline" className="w-full gap-2 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20">
                <Trash2 className="w-4 h-4" />
                Delete Asset
            </Button>
        </div>
      )}
    </div>
  );
}
