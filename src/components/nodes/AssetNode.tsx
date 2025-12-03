import { memo, useMemo, useCallback } from 'react';
import { NodeProps, Node } from '@xyflow/react';
import { useProjectStore } from '@/store/projectStore';
import { useStore as useZustandStore } from 'zustand';
import { AssetData, CollectionAssetProperties } from '@/types/project';

// Import Components
import { BaseNodeFrame, InputHandleConfig } from './base/BaseNodeFrame';
import { ImageNodeView } from './views/ImageNodeView';
import { TextNodeView } from './views/TextNodeView';
import { CollectionNodeView } from './views/CollectionNodeView';
import { FileText, Image as ImageIcon, Terminal, FolderOpen, Settings2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RECIPES } from '@/config/recipeRegistry';

// Extend AssetData with UI-only props injected by Canvas
export type UIAssetNodeData = AssetData & {
  projectPath?: string;
  dropTargetState?: 'hover' | 'ready' | 'none';
  onResizeCommit?: (nodeId: string, oldWidth: number, oldHeight: number, newWidth: number, newHeight: number) => Promise<void>;
};

const getTypeColor = (accepts: string[]): string => {
    if (accepts.includes('*')) return '#9ca3af'; // gray-400
    if (accepts.some(t => t.includes('image'))) return '#ec4899'; // pink-500
    if (accepts.some(t => t.includes('text'))) return '#3b82f6'; // blue-500
    if (accepts.some(t => t.includes('collection'))) return '#f59e0b'; // amber-500
    return '#6b7280'; // gray-500
};

const AssetNode = ({ id, data, selected, dragging }: NodeProps<Node<UIAssetNodeData>>) => {
  
  // --- 1. Reference Resolution ---
  // Use selector for child count to avoid unnecessary re-renders
  const childCount = useProjectStore(useCallback(
      (state) => state.nodes.filter(n => n.parentId === id).length,
      [id]
  ));

  // We still need access to full nodes for reference resolution (this could be optimized too, but acceptable for now)
  const nodes = useProjectStore(state => state.nodes);
  const updateNodeData = useProjectStore(state => state.updateNodeData);
  const runNodeRecipe = useProjectStore(state => state.runNodeRecipe);
  const { pause, resume } = useZustandStore(useProjectStore.temporal, (state) => state);

  // Safer access using type guard
  const targetId = (data.assetType === 'reference_asset' && 'targetId' in data.properties) 
      ? (data.properties as any).targetId 
      : null;
  
  const targetNode = useMemo(() => {
      if (!targetId) return null;
      return nodes.find(n => n.id === targetId);
  }, [nodes, targetId]);

  // Determine effective data to render
  const displayData = targetNode ? targetNode.data : data;
  const isBrokenLink = data.assetType === 'reference_asset' && !targetNode;

  const hasRecipe = !!displayData.provenance?.recipeId;
  const isRecipeIdle = hasRecipe && displayData.status === 'idle';

  // --- Prepare Input Handles ---
  const inputHandles: InputHandleConfig[] = useMemo(() => {
      if (!hasRecipe) return [];
      const recipe = RECIPES.find(r => r.id === displayData.provenance!.recipeId);
      if (!recipe) return [];
      
      return recipe.inputs.map((input, idx) => ({
          id: `input-${idx}`, // Standardized ID for slots
          label: input.label,
          color: getTypeColor(input.accepts)
      }));
  }, [hasRecipe, displayData.provenance]);

  // --- 2. Toggle Logic ---
  const handleToggle = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      if (displayData.assetType === 'collection_asset') {
           const props = displayData.properties as CollectionAssetProperties;
           const currentCollapsed = props.collapsed !== false; 
           updateNodeData(id, { 
              properties: { collapsed: !currentCollapsed } 
           });
      }
  }, [id, displayData, updateNodeData]);

  const handleRunRecipe = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      runNodeRecipe(id);
  }, [id, runNodeRecipe]);

  // --- 3. Resize Handlers ---
  const onResizeStart = useCallback(() => {
      pause();
  }, [pause]);

  const onResizeEnd = useCallback((_event: any, params: any) => {
    if (data.onResizeCommit) {
      data.onResizeCommit(id, 0, 0, params.width, params.height);
    }
    resume();
  }, [id, data, resume]);

  // --- 4. Icon & Status Helpers ---
  const icon = useMemo(() => {
    if (isRecipeIdle) return <Settings2 className="w-4 h-4" />;
    
    switch (displayData.assetType) {
      case 'image_asset': return <ImageIcon className="w-4 h-4" />;
      case 'text_asset': return <FileText className="w-4 h-4" />;
      case 'prompt_asset': return <Terminal className="w-4 h-4" />;
      case 'collection_asset': return <FolderOpen className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  }, [displayData.assetType, isRecipeIdle]);

  const statusIndicator = useMemo(() => {
    if (isBrokenLink) return 'bg-red-500';
    switch (displayData.status) {
      case 'success': return 'bg-green-500';
      case 'stale': return 'bg-yellow-500';
      case 'processing': return 'bg-blue-500 animate-pulse';
      case 'error': return 'bg-red-500';
      default: return 'bg-slate-500'; // Idle
    }
  }, [isBrokenLink, displayData.status]);

  const borderClass = useMemo(() => {
    // Drag Over States (Highest Priority)
    if (data.dropTargetState === 'ready') return 'ring-4 ring-green-500 border-green-500 scale-[1.02] shadow-xl z-50';
    if (data.dropTargetState === 'hover') return 'ring-2 ring-green-400/50 border-green-400/50 border-dashed';

    if (selected) return 'ring-2 ring-primary border-transparent'; 
    if (isBrokenLink) return 'border-red-500 border-dashed';
    
    switch (displayData.status) {
      case 'processing': return 'border-blue-500 ring-1 ring-blue-500/50';
      case 'stale': return 'border-yellow-500 border-dashed bg-yellow-500/5';
      case 'error': return 'border-red-500 bg-red-500/5';
      default: return 'border-border/60'; 
    }
  }, [data.dropTargetState, selected, isBrokenLink, displayData.status]);

  const label = (displayData.properties?.name as string) || (displayData as any).label || "Untitled";

  // --- 5. Render Content View ---
  const renderContent = () => {
    if (isBrokenLink) {
      return (
        <div className="flex items-center justify-center h-full text-destructive/50 p-4 text-center">
           <div className="text-sm font-semibold">Reference Broken</div>
        </div>
      );
    }

    // Standard View
    let content = null;
    switch (displayData.assetType) {
      case 'image_asset':
      case 'Image': 
        content = <ImageNodeView data={displayData} projectPath={data.projectPath} />;
        break;
      case 'text_asset':
      case 'Text':
      case 'prompt_asset':
      case 'Prompt':
        content = <TextNodeView data={displayData} />;
        break;
      case 'collection_asset':
        const collectionProps = displayData.properties as CollectionAssetProperties;
        const isCollapsed = collectionProps.collapsed !== false; 
        content = <CollectionNodeView 
                  nodeId={id}
                  isCollapsed={isCollapsed}
                  isReadyToDrop={data.dropTargetState === 'ready'} 
                  isHovering={data.dropTargetState === 'hover'} 
                  childCount={childCount}
                  onToggle={handleToggle}
               />;
        break;
      default:
        content = <TextNodeView data={displayData} />;
    }

    // Overlay for Recipe Idle State
    if (isRecipeIdle) {
        return (
            <div className="relative w-full h-full group">
                {/* Dimmed Background Content */}
                <div className="w-full h-full opacity-30 pointer-events-none filter grayscale">
                    {content}
                </div>
                
                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <Button 
                        variant="outline" 
                        size="icon" 
                        className="w-12 h-12 rounded-full shadow-lg bg-background/80 hover:bg-primary hover:text-primary-foreground transition-all duration-300 border-2 border-primary/20"
                        onClick={handleRunRecipe}
                    >
                        <Play className="w-6 h-6 fill-current ml-1" />
                    </Button>
                </div>
            </div>
        );
    }

    return content;
  };

  return (
    <BaseNodeFrame
      id={id}
      selected={selected}
      dragging={dragging}
      data={data}
      icon={icon}
      label={label}
      statusIndicator={statusIndicator}
      borderClass={borderClass}
      isBrokenLink={isBrokenLink}
      onResizeStart={onResizeStart}
      onResizeEnd={onResizeEnd}
      onHeaderDoubleClick={handleToggle}
      inputHandles={inputHandles}
    >
      {renderContent()}
    </BaseNodeFrame>
  );
};

export default memo(AssetNode);