import { useWorkflowStore } from "@/store/workflowStore";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";

export const InspectorPanel = () => {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  
  // Find selected node (single selection only for now)
  // If multiple selected, usually we show "Multiple items selected" or common properties.
  // For MVP, just grab the first one or null.
  const selectedNodes = nodes.filter((n) => n.selected);
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;
  
  const [title, setTitle] = useState("");

  // Sync local state with selected node
  useEffect(() => {
      if (selectedNode) {
          setTitle(selectedNode.data.title || "");
      } else {
          setTitle("");
      }
  }, [selectedNode]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVal = e.target.value;
      setTitle(newVal);
      if (selectedNode) {
          updateNodeData(selectedNode.id, { title: newVal });
      }
  };

  if (selectedNodes.length === 0) {
    return null;
  }
  
  if (selectedNodes.length > 1) {
    // For now, hide on multiple selection too, or we could show a summary
    return null;
  }

  // Safe check
  if (!selectedNode) return null;

  const inDegree = edges.filter(e => e.target === selectedNode.id).length;
  const outDegree = edges.filter(e => e.source === selectedNode.id).length;

  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 w-[320px] h-[80vh] min-h-[300px] bg-card/95 backdrop-blur-sm border rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-right-4 fade-in duration-200">
      <div className="p-4 border-b font-semibold bg-muted/50 flex items-center justify-between shrink-0">
          <span>Inspector</span>
          <div className="flex items-center gap-2">
             {/* Optional actions like Close could go here */}
          </div>
      </div>
      <ScrollArea className="flex-1 p-4 w-full min-h-0">
        <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
                <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Label htmlFor="node-title">Label</Label>
                    <Input 
                        id="node-title" 
                        value={title} 
                        onChange={handleTitleChange} 
                        className="bg-background"
                    />
                </div>

                {/* Connection Stats */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-muted/30 rounded p-2 flex flex-col items-center border border-border/50">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Inputs</span>
                        <span className="text-lg font-mono font-medium text-primary">{inDegree}</span>
                    </div>
                    <div className="bg-muted/30 rounded p-2 flex flex-col items-center border border-border/50">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Outputs</span>
                        <span className="text-lg font-mono font-medium text-primary">{outDegree}</span>
                    </div>
                </div>
                
                <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Label>Type</Label>
                    <div className="px-3 py-1 rounded-md bg-muted text-sm font-medium capitalize">
                        {selectedNode.type}
                    </div>
                </div>

                <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Label>ID</Label>
                    <div className="text-[10px] font-mono text-muted-foreground break-all bg-muted/30 p-2 rounded">
                        {selectedNode.id}
                    </div>
                </div>
            </div>
            
            <Separator />
            
            {/* Geometry */}
            <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground font-bold">Transform</Label>
                <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <Label className="text-xs">X</Label>
                        <div className="text-sm font-mono p-2 bg-muted/30 rounded">
                            {Math.round(selectedNode.position.x)}
                        </div>
                     </div>
                     <div className="space-y-1">
                        <Label className="text-xs">Y</Label>
                        <div className="text-sm font-mono p-2 bg-muted/30 rounded">
                            {Math.round(selectedNode.position.y)}
                        </div>
                     </div>
                </div>
            </div>
            
             <Separator />

            {/* Data Preview (Debug) */}
            <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground font-bold">Data</Label>
                <pre className="text-[10px] bg-muted p-2 rounded overflow-x-auto max-h-40">
                    {JSON.stringify(selectedNode.data, null, 2)}
                </pre>
            </div>
        </div>
      </ScrollArea>
    </div>
  );
};
