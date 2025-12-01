import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Image as ImageIcon, Terminal, Link as LinkIcon, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Define the data expected by this node
export type AssetNodeData = {
  label: string;
  type: 'Image' | 'Text' | 'Prompt' | 'Link' | 'Grid' | 'Other';
  status: 'Active' | 'Outdated' | 'Processing' | 'Error';
  preview?: string; // Text content or Image URL
};

const AssetNode = ({ data, selected }: NodeProps<AssetNodeData>) => {
  
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
      "relative group transition-all duration-200",
      selected ? "ring-2 ring-primary shadow-lg" : ""
    )}>
      {/* Input Handle */}
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-muted-foreground" />

      <Card className="w-[240px] overflow-hidden border-border/60 bg-card shadow-sm">
        {/* Header */}
        <CardHeader className="p-3 flex flex-row items-center justify-between space-y-0 border-b border-border/50 bg-muted/20">
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", getStatusColor())} />
            <div className="text-muted-foreground">
              {getIcon()}
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {data.type}
            </span>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </CardHeader>

        {/* Content Preview */}
        <CardContent className="p-0">
          {data.type === 'Image' ? (
            <div className="h-[140px] bg-secondary/50 flex items-center justify-center relative overflow-hidden">
               {/* Placeholder for now */}
               {data.preview ? (
                 <img src={data.preview} alt="preview" className="w-full h-full object-cover" />
               ) : (
                 <div className="text-muted-foreground/30 flex flex-col items-center gap-2">
                   <ImageIcon className="w-8 h-8" />
                   <span className="text-xs">No Preview</span>
                 </div>
               )}
            </div>
          ) : (
            <div className="h-[140px] p-3 text-xs text-muted-foreground font-mono bg-background/50 overflow-hidden relative">
              {data.preview || "No content..."}
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent" />
            </div>
          )}
        </CardContent>

        {/* Footer / Meta */}
        <div className="p-2 bg-muted/20 border-t border-border/50 flex justify-between items-center text-[10px] text-muted-foreground">
           <span>v1.0</span>
           <span className="font-mono">ID: {data.label.slice(0,4)}...</span>
        </div>
      </Card>

      {/* Output Handle */}
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-primary" />
    </div>
  );
};

export default memo(AssetNode);
