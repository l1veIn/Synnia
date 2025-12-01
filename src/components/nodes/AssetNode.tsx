import { memo, useMemo, useCallback } from 'react';
import { Handle, Position, NodeProps, NodeResizer, ResizeParams } from '@xyflow/react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FileText, Image as ImageIcon, Terminal, Link as LinkIcon, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { convertFileSrc } from '@tauri-apps/api/core';

export type AssetNodeData = {
  label: string;
  type: 'Image' | 'Text' | 'Prompt' | 'Link' | 'Grid' | 'Other';
  status: 'Active' | 'Outdated' | 'Processing' | 'Error';
  preview?: string; 
  projectPath?: string;
  onResizeCommit?: (nodeId: string, oldWidth: number, oldHeight: number, newWidth: number, newHeight: number) => Promise<void>;
};

const AssetNode = ({ id, data, selected, xPos, yPos, style }: NodeProps<AssetNodeData>) => {
  
  const onResizeEnd = useCallback((event: any, params: ResizeParams) => {
    // Current dimensions (before this resize applies to the node's style)
    // params only contains new width/height. 
    // If style.width is not set, we assume default min dimensions.
    const oldWidth = style?.width ? Number(style.width) : 160;
    const oldHeight = style?.height ? Number(style.height) : 100;

    if (data.onResizeCommit) {
      data.onResizeCommit(id, oldWidth, oldHeight, params.width, params.height);
    }
  }, [id, data.onResizeCommit, style]);

  const imageUrl = useMemo(() => {
      if (data.type === 'Image' && data.preview) {
          if (data.preview.startsWith('http') || data.preview.startsWith('data:')) {
              return data.preview;
          }
          if (data.projectPath) {
             const rawPath = `${data.projectPath}/${data.preview}`;
             const normalizedPath = rawPath.replace(/\\/g, '/').replace(/\/+/g, '/');
             return convertFileSrc(normalizedPath);
          }
          return convertFileSrc(data.preview);
      }
      return null;
  }, [data.preview, data.projectPath, data.type]);

  const getIcon = () => {
    switch (data.type) {
      case 'Image': return <ImageIcon className="w-4 h-4" />;
      case 'Text': return <FileText className="w-4 h-4" />;
      case 'Prompt': return <Terminal className="w-4 h-4" />;
      case 'Link': return <LinkIcon className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getStatusColor = () => {
    switch (data.status) {
      case 'Active': return 'bg-green-500';
      case 'Outdated': return 'bg-red-500';
      case 'Processing': return 'bg-blue-500 animate-pulse';
      case 'Error': return 'bg-orange-500';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div className={cn(
      "relative group transition-all duration-200 h-full w-full", 
      selected ? "shadow-lg" : ""
    )}>
      <NodeResizer 
        color="#3b82f6" 
        isVisible={selected} 
        minWidth={160} 
        minHeight={100} 
        onResizeEnd={onResizeEnd}
      />

      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-muted-foreground" />

      <Card className={cn(
          "h-full w-full overflow-hidden border-border/60 bg-card shadow-sm flex flex-col",
          selected ? "ring-2 ring-primary" : ""
        )}>
        {/* Header */}
        <CardHeader className="p-2 flex flex-row items-center justify-between space-y-0 border-b border-border/50 bg-muted/20 shrink-0 h-10">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className={cn("w-2 h-2 rounded-full shrink-0", getStatusColor())} />
            <div className="text-muted-foreground shrink-0">
              {getIcon()}
            </div>
            <span className="text-xs font-semibold truncate text-muted-foreground">
              {data.label}
            </span>
          </div>
        </CardHeader>

        {/* Content Preview (Flexible Height) */}
        <CardContent className="p-0 flex-1 min-h-0 relative">
          {data.type === 'Image' ? (
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
            <div className="w-full h-full p-3 text-xs text-muted-foreground font-mono bg-background/50 overflow-auto">
              {data.preview || "No content..."}
            </div>
          )}
        </CardContent>
      </Card>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-primary" />
    </div>
  );
};

export default memo(AssetNode);
