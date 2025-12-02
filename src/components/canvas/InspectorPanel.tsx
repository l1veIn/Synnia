import { useState, useEffect } from "react";
import { UIAssetNodeData } from "@/components/nodes/AssetNode";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, MessageSquare, Trash2, ChevronLeft } from "lucide-react";
import { Node } from "@xyflow/react";
import { ChatInterface, Message } from "./ChatInterface";
import { toast } from "sonner";
import { useProjectStore } from "@/store/projectStore";

interface InspectorPanelProps {
  node: Node<UIAssetNodeData> | null;
  selectedCount: number;
  onClose: () => void;
  onRefreshGraph: () => void; 
  onDelete: (id: string) => void;
}

export function InspectorPanel({ node, selectedCount, onClose, onDelete }: InspectorPanelProps) {
  const [mode, setMode] = useState<'details' | 'chat'>('details');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const updateNodeData = useProjectStore(state => state.updateNodeData);

  const handleDelete = () => {
      if (node) {
          onDelete(node.id);
          onClose();
      }
  };

  // Reset state when node changes
  useEffect(() => {
      setMode('details');
      setMessages([]);
      setIsProcessing(false);
  }, [node?.id, selectedCount]);

  if (selectedCount === 0) return null;
  
  if (selectedCount > 1) {
      return (
        <div className="absolute top-4 right-4 w-80 bg-background/95 backdrop-blur border border-border/60 shadow-2xl rounded-xl overflow-hidden flex flex-col z-20 animate-in slide-in-from-right-10 fade-in duration-200">
            <div className="h-14 px-4 border-b border-border/50 flex items-center justify-between bg-muted/30">
                <span className="font-semibold">{selectedCount} Items Selected</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                    <X className="w-4 h-4" />
                </Button>
            </div>
            <div className="p-4 space-y-4">
                <div className="p-3 bg-muted/50 rounded text-xs text-muted-foreground">
                    Batch operations coming soon.
                </div>
            </div>
        </div>
      );
  }

  if (!node) return null;

  const { data } = node;
  const label = (data.properties?.name as string) || (data as any).label || "Untitled";
  const content = (data.properties?.content as string) || "";
  const isTextBased = ['text_asset', 'prompt_asset', 'Text', 'Prompt'].includes(data.assetType);
  const isReadOnly = !!data.provenance; // Generated nodes are read-only

  const handleContentChange = (val: string) => {
      updateNodeData(node.id, { properties: { content: val } });
  };

  const handleNameChange = (val: string) => {
      updateNodeData(node.id, { properties: { name: val } });
  };

  const handleSendMessage = async () => {
     toast.info("Chat disabled in this version.");
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
            {mode === 'chat' ? `Chat: ${label.slice(0,8)}...` : label}
            </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Body Switcher */}
      {mode === 'chat' ? (
          <ChatInterface 
            onSendMessage={handleSendMessage} 
            messages={messages} 
            isProcessing={isProcessing} 
          />
      ) : (
        /* Details View */
        <div className="flex-1 overflow-hidden flex flex-col">
            <div className="p-4 pb-2">
                <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline" className="uppercase text-[10px]">{data.assetType}</Badge>
                <Badge className={
                    data.status === 'success' ? "bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20" : 
                    data.status === 'stale' ? "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border-yellow-500/20" :
                    "bg-slate-500/10 text-slate-500 border-slate-500/20"
                }>
                    {data.status}
                </Badge>
                </div>
                
                <Button className="w-full gap-2" size="lg" onClick={() => setMode('chat')} disabled>
                    <MessageSquare className="w-4 h-4" />
                    Chat with Agent (Soon)
                </Button>
            </div>

            <Separator />

            <Tabs defaultValue="details" className="flex-1 flex flex-col">
                <div className="px-4 pt-2">
                    <TabsList className="w-full grid grid-cols-3">
                        <TabsTrigger value="details">Editor</TabsTrigger>
                        <TabsTrigger value="provenance">Graph</TabsTrigger>
                        <TabsTrigger value="debug">Raw</TabsTrigger>
                    </TabsList>
                </div>
                
                <ScrollArea className="flex-1">
                    <TabsContent value="details" className="p-4 space-y-6 m-0">
                        {isReadOnly && (
                            <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-[10px] text-yellow-600 dark:text-yellow-400">
                                Generated Asset (Read-Only). Detach to edit.
                            </div>
                        )}

                        {/* Name Field */}
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground font-medium">Name</Label>
                            <Input 
                                value={label} 
                                onChange={(e) => handleNameChange(e.target.value)}
                                className="h-8"
                                // Name is usually editable even for generated assets? 
                                // Houdini allows renaming. Let's allow it.
                            />
                        </div>

                        {/* Content Field (Conditional) */}
                        {isTextBased && (
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground font-medium">Content</Label>
                                <Textarea 
                                    value={content} 
                                    onChange={(e) => handleContentChange(e.target.value)}
                                    className="min-h-[200px] font-mono text-xs"
                                    disabled={isReadOnly} // LOCKED
                                />
                            </div>
                        )}
                        
                        {/* Info */}
                        <div className="space-y-1 pt-4 border-t border-border/50">
                            <span className="text-xs text-muted-foreground font-medium">ID</span>
                            <p className="text-[10px] font-mono text-muted-foreground truncate select-all">
                                {node.id}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs text-muted-foreground font-medium">Hash</span>
                            <p className="text-[10px] font-mono text-muted-foreground truncate select-all">
                                {data.hash || 'No Hash'}
                            </p>
                        </div>
                    </TabsContent>
                    
                    <TabsContent value="provenance" className="p-4 m-0">
                        {data.provenance ? (
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <Label className="text-xs">Recipe</Label>
                                    <div className="text-sm font-medium">{data.provenance.recipeId}</div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Generated At</Label>
                                    <div className="text-xs text-muted-foreground">
                                        {new Date(Number(data.provenance.generatedAt)).toLocaleString()}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Sources</Label>
                                    {data.provenance.sources.map((s, i) => (
                                        <div key={i} className="text-xs border p-2 rounded bg-muted/30">
                                            <div className="font-mono truncate">{s.nodeId}</div>
                                            <div className="text-muted-foreground text-[10px]">Hash: {s.nodeHash?.slice(0,8)}...</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground italic">
                                This is a raw asset (Root Node).
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="debug" className="p-4 m-0">
                        <pre className="text-[10px] font-mono bg-muted p-2 rounded overflow-auto">
                            {JSON.stringify(data, (_key, value) => 
                                typeof value === 'bigint' ? value.toString() : value
                            , 2)}
                        </pre>
                    </TabsContent>
                </ScrollArea>
            </Tabs>
        </div>
      )}

      {/* Footer Actions */}
      {mode === 'details' && (
            <div className="p-4 border-t border-border/50 bg-muted/10">
                    <Button variant="outline" className="w-full gap-2 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 text-destructive" onClick={handleDelete}>
                        <Trash2 className="w-4 h-4" />
                        Delete Asset
                    </Button>
            </div>      )}
    </div>
  );
}