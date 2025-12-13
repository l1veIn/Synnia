import { useWorkflowStore } from "@/store/workflowStore";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";
import { SynniaNode, NodeType } from "@/types/project";
import { inspectorTypes } from '@/components/workflow/nodes';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DebugInspector } from "./inspector/DebugInspector";
import { Bug, Settings2, GripHorizontal } from "lucide-react";
import { motion, useDragControls, useMotionValue } from "framer-motion";
import { graphEngine } from "@/lib/engine/GraphEngine";

// Helper Component for Asset/Recipe Editing
const NodeInspector = ({ node }: { node: SynniaNode }) => {
    const assetId = node.data.assetId as string | undefined;
    const recipeId = (node.data as any).recipeId as string | undefined;

    // Get the Inspector component for this node type
    const Inspector = inspectorTypes[node.type];

    if (Inspector) {
        // Pass both assetId and nodeId - Inspector can use what it needs
        return <Inspector assetId={assetId} nodeId={node.id} />;
    }

    // Fallback for nodes without custom inspector
    if (!assetId && !recipeId) {
        return <div className="p-4 text-xs text-muted-foreground">No inspector available for this node</div>;
    }

    return (
        <div className="p-4 space-y-4">
            <div className="text-xs text-muted-foreground">
                Properties for <span className="font-bold uppercase">{node.type}</span>
            </div>
            {assetId && (
                <div className="text-[10px] text-muted-foreground font-mono">
                    Asset ID: {assetId}
                </div>
            )}
            {recipeId && (
                <div className="text-[10px] text-muted-foreground font-mono">
                    Recipe ID: {recipeId}
                </div>
            )}
        </div>
    );
};

export const InspectorPanel = () => {
    const nodes = useWorkflowStore((state) => state.nodes);
    const edges = useWorkflowStore((state) => state.edges);
    const inspectorPosition = useWorkflowStore((state) => state.inspectorPosition);
    const setInspectorPosition = useWorkflowStore((state) => state.setInspectorPosition);

    // Find selected node (single selection only for now)
    const selectedNodes = nodes.filter((n) => n.selected);
    const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;

    const [title, setTitle] = useState("");
    const dragControls = useDragControls();

    // Position State (Relative offset from default CSS position)
    const x = useMotionValue(inspectorPosition?.x || 0);
    const y = useMotionValue(inspectorPosition?.y || 0);

    // Sync local state with selected node
    useEffect(() => {
        if (selectedNode) {
            setTitle(selectedNode.data.title || "");
        } else {
            setTitle("");
        }
    }, [selectedNode]);

    // Update motion values if store changes externally (e.g. reset layout)
    useEffect(() => {
        x.set(inspectorPosition?.x || 0);
        y.set(inspectorPosition?.y || 0);
    }, [inspectorPosition, x, y]);

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value;
        setTitle(newVal);
        if (selectedNode) {
            graphEngine.updateNode(selectedNode.id, { data: { title: newVal } });
        }
    };

    if (!selectedNode) return null;

    const inDegree = edges.filter(e => e.target === selectedNode.id).length;
    const outDegree = edges.filter(e => e.source === selectedNode.id).length;

    // Check if it's an Asset Node or Recipe Node (needs NodeInspector)
    const assetId = selectedNode.data.assetId;
    const recipeId = (selectedNode.data as any).recipeId;
    const hasInspector = assetId || recipeId || inspectorTypes[selectedNode.type];

    return (
        <motion.div
            drag
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            style={{ x, y }}
            onDragEnd={() => {
                setInspectorPosition({ x: x.get(), y: y.get() });
            }}
            className="absolute right-4 top-20 w-[340px] h-[75vh] min-h-[400px] bg-card/95 backdrop-blur-sm border rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden"
        >
            {/* Draggable Header */}
            <div
                className="h-9 shrink-0 bg-muted/50 border-b flex items-center justify-between px-3 cursor-grab active:cursor-grabbing select-none"
                onPointerDown={(e) => dragControls.start(e)}
            >
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                    <GripHorizontal className="h-3 w-3" />
                    Inspector
                </span>
            </div>

            <Tabs defaultValue="properties" className="flex flex-col flex-1 min-h-0 w-full">
                <div className="px-3 py-3 shrink-0 border-b bg-card">
                    <TabsList className="grid w-full grid-cols-2 h-9">
                        <TabsTrigger value="properties" className="text-xs h-full">
                            <Settings2 className="h-3 w-3 mr-2" /> Properties
                        </TabsTrigger>
                        <TabsTrigger value="debug" className="text-xs h-full">
                            <Bug className="h-3 w-3 mr-2" /> Debug
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* Tab: Properties (Original Inspector Logic) */}

                <TabsContent value="properties" className="flex-1 min-h-0 flex flex-col m-0 data-[state=inactive]:hidden">
                    {hasInspector ? (
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
                                <NodeInspector node={selectedNode} />
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
                </TabsContent>

                {/* Tab: Debug (New Inspector) */}
                <TabsContent value="debug" className="flex-1 min-h-0 m-0 data-[state=inactive]:hidden">
                    <DebugInspector nodeId={selectedNode.id} />
                </TabsContent>
            </Tabs>
        </motion.div>
    );
};
