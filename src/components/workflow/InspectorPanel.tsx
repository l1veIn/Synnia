import { useWorkflowStore } from "@/store/workflowStore";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";
import { useAsset } from "@/hooks/useAsset";
import { FormAssetEditor } from "./inspector/FormAssetEditor";

// Helper Component for Asset Editing
const AssetInspector = ({ assetId }: { assetId: string }) => {
    const { asset, setContent } = useAsset(assetId);
    if (!asset) return <div className="p-4 text-xs text-muted-foreground">Asset not found ({assetId})</div>;

    if (asset.type === 'json') {
        return <FormAssetEditor asset={asset} onUpdate={setContent} />;
    }
    
    // Fallback for other assets
    return (
        <div className="p-4 space-y-4">
             <div className="text-xs text-muted-foreground">
                 Properties for <span className="font-bold uppercase">{asset.type}</span> asset.
             </div>
             <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label className="text-xs">Asset Name</Label>
                <Input value={asset.metadata.name} readOnly className="h-8 text-xs bg-muted" />
             </div>
             <div className="text-[10px] text-muted-foreground font-mono">
                 ID: {asset.id}
             </div>
        </div>
    );
};

export const InspectorPanel = () => {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  
  // Find selected node (single selection only for now)
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

  if (!selectedNode) return null;

  const inDegree = edges.filter(e => e.target === selectedNode.id).length;
  const outDegree = edges.filter(e => e.source === selectedNode.id).length;
  
  // Check if it's an Asset Node
  const assetId = selectedNode.data.assetId;

  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 w-[320px] h-[80vh] min-h-[300px] bg-card/95 backdrop-blur-sm border rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-right-4 fade-in duration-200">
      <div className="p-4 border-b font-semibold bg-muted/50 flex items-center justify-between shrink-0 h-14">
          <span>Inspector</span>
      </div>
      
      {/* If it's an Asset Node with valid ID, show custom editor */}
      {assetId ? (
          <div className="flex-1 flex flex-col min-h-0">
             {/* Common Header for Asset Nodes */}
             <div className="px-4 py-3 space-y-3 border-b shrink-0 bg-card z-10">
                <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="node-title" className="text-xs text-muted-foreground">Node Label</Label>
                    <Input 
                        id="node-title" 
                        value={title} 
                        onChange={handleTitleChange} 
                        className="bg-background h-8 text-xs"
                    />
                </div>
             </div>
             
             {/* Asset Specific Editor */}
             <div className="flex-1 min-h-0 relative">
                 <AssetInspector assetId={assetId} />
             </div>
          </div>
      ) : (
          /* Standard Node Inspector (Groups, Racks, etc) */
          <ScrollArea className="flex-1 p-4 w-full min-h-0">
            <div className="space-y-6">
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
                </div>
                
                <Separator />
                
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
            </div>
          </ScrollArea>
      )}
    </div>
  );
};
