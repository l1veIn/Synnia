import { memo, useMemo, useCallback } from 'react';
import { Handle, Position, NodeProps, NodeResizer, ResizeParams, Node } from '@xyflow/react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FileText, Image as ImageIcon, Terminal, Link as LinkIcon, CornerUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { convertFileSrc } from '@tauri-apps/api/core';
import { AssetData } from '@/types/project';
import { useProjectStore } from '@/store/projectStore'; // Needed for lookup
import { useStore as useZustandStore } from 'zustand'; // Added

// Extend AssetData with UI-only props injected by Canvas
export type UIAssetNodeData = AssetData & {
  projectPath?: string;
  onResizeCommit?: (nodeId: string, oldWidth: number, oldHeight: number, newWidth: number, newHeight: number) => Promise<void>;
};

const AssetNode = ({ id, data, selected }: NodeProps<Node<UIAssetNodeData>>) => {
  
  // Reference Lookup Logic
  const nodes = useProjectStore(state => state.nodes);
  const { pause, resume } = useZustandStore(useProjectStore.temporal, (state) => state); // Temporal controls

  const targetId = data.assetType === 'reference_asset' ? data.properties?.targetId as string : null;
  
  // If it's a reference, we use the target node's data for rendering content,
  // but keep the shortcut's own label if customized (or fallback to target's label).
  const targetNode = useMemo(() => {
      if (!targetId) return null;
      return nodes.find(n => n.id === targetId);
  }, [nodes, targetId]);

  // Determine effective data to render
  const displayData = targetNode ? targetNode.data : data;
  const isBrokenLink = data.assetType === 'reference_asset' && !targetNode;

  const onResizeStart = useCallback(() => {
      pause();
  }, [pause]);

  const onResizeEnd = useCallback((_event: any, params: ResizeParams) => {
    if (data.onResizeCommit) {
      data.onResizeCommit(id, 0, 0, params.width, params.height);
    }
    resume();
  }, [id, data, resume]);

  const imageUrl = useMemo(() => {
      // Access properties using index signature if TS complains, or cast
      const props = displayData.properties as Record<string, any>;
      
      if (displayData.assetType === 'image_asset' || displayData.assetType === 'Image') {
          const contentStr = (props?.content as string) || (props?.src as string);
          if (contentStr) {
              if (contentStr.startsWith('http') || contentStr.startsWith('data:')) {
                  return contentStr;
              }
              if (data.projectPath) {
                 const rawPath = `${data.projectPath}/${contentStr}`;
                 const normalizedPath = rawPath.replace(/\\/g, '/').replace(/\/+/g, '/');
                 return convertFileSrc(normalizedPath);
              }
              return convertFileSrc(contentStr);
          }
      }
      return null;
  }, [displayData.properties, displayData.assetType, data.projectPath]);

  const getIcon = () => {
    if (isBrokenLink) return <LinkIcon className="w-4 h-4 text-destructive" />;
    
    switch (displayData.assetType) {
      case 'image_asset': return <ImageIcon className="w-4 h-4" />;
      case 'text_asset': return <FileText className="w-4 h-4" />;
      case 'prompt_asset': return <Terminal className="w-4 h-4" />;
      case 'Image': return <ImageIcon className="w-4 h-4" />;
      case 'Text': return <FileText className="w-4 h-4" />;
      case 'Prompt': return <Terminal className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getStatusIndicator = () => {
    if (isBrokenLink) return 'bg-red-500';
    switch (displayData.status) {
      case 'success': return 'bg-green-500';
      case 'stale': return 'bg-yellow-500';
      case 'processing': return 'bg-blue-500 animate-pulse';
      case 'error': return 'bg-red-500';
      default: return 'bg-slate-500';
    }
  };

  const getBorderClass = () => {
    if (selected) return 'ring-2 ring-primary border-transparent'; 
    if (isBrokenLink) return 'border-red-500 border-dashed';
    
    switch (displayData.status) {
      case 'processing': return 'border-blue-500 ring-1 ring-blue-500/50';
      case 'stale': return 'border-yellow-500 border-dashed bg-yellow-500/5';
      case 'error': return 'border-red-500 bg-red-500/5';
      default: return 'border-border/60'; 
    }
  };

  const props = displayData.properties as Record<string, any>;
  const label = (props?.name as string) || (displayData as any).label || "Untitled";
  const content = (props?.content as string) || "No content available.";

  return (
    <div className={cn(
      "relative group transition-all duration-200 h-full w-full", 
      selected ? "shadow-lg" : ""
    )}>
      <NodeResizer 
        color="#3b82f6" 
        isVisible={!!selected} 
        minWidth={160} 
        minHeight={100} 
        onResizeStart={onResizeStart}
        onResizeEnd={onResizeEnd}
      />

      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-muted-foreground" />

      <Card className={cn(
          "h-full w-full overflow-hidden bg-card shadow-sm flex flex-col border-2 transition-colors duration-300",
          getBorderClass(),
          data.assetType === 'reference_asset' ? "opacity-90" : "" 
        )}>
        {/* Header */}
        <CardHeader className="p-2 flex flex-row items-center justify-between space-y-0 border-b border-border/50 bg-muted/20 shrink-0 h-10">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className={cn("w-2 h-2 rounded-full shrink-0 transition-colors", getStatusIndicator())} />
            <div className="text-muted-foreground shrink-0">
              {getIcon()}
            </div>
            <span className="text-xs font-semibold truncate text-muted-foreground">
              {isBrokenLink ? "Broken Reference" : label}
            </span>
          </div>
          {/* Shortcut Indicator Icon */}
          {data.assetType === 'reference_asset' && (
              <CornerUpRight className="w-3 h-3 text-blue-500" />
          )}
        </CardHeader>

        {/* Content Preview (Flexible Height) */}
        <CardContent className="p-0 flex-1 min-h-0 relative">
          {(displayData.assetType === 'image_asset' || displayData.assetType === 'Image') ? (
            <div className="w-full h-full bg-secondary/50 flex items-center justify-center overflow-hidden">
               {imageUrl ? (
                 <img src={imageUrl} alt="preview" className="w-full h-full object-cover" />
               ) : (
                 <div className="text-muted-foreground/30 flex flex-col items-center gap-2">
                   <ImageIcon className="w-8 h-8" />
                 </div>
               )}
            </div>
          ) : (
            <div className="w-full h-full p-3 text-xs text-muted-foreground font-mono bg-background/50 overflow-auto whitespace-pre-wrap">
              {String(content)}
            </div>
          )}
        </CardContent>
      </Card>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-primary" />
    </div>
  );
};

export default memo(AssetNode);