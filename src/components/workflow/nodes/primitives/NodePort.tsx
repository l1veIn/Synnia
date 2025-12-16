import { Handle, HandleProps, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { HandleSemantic, HANDLE_IDS, HANDLE_CONFIG } from "@/types/handles";

interface NodePortProps extends HandleProps {
  className?: string;
}

function NodePortBase({ className, position, isConnectable = true, ...props }: NodePortProps) {
  const positionClasses = {
    [Position.Top]: "-top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full",
    [Position.Bottom]: "-bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full",
    [Position.Left]: "-left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full",
    [Position.Right]: "-right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full",
  };

  return (
    <Handle
      position={position}
      isConnectable={isConnectable}
      className={cn(
        "border border-background transition-colors hover:brightness-110 z-50",
        positionClasses[position],
        !isConnectable && "opacity-50 cursor-not-allowed",
        className
      )}
      {...props}
    />
  );
}

// --- Semantic Sub-components ---

/** ORIGIN Handle - Top violet, indicates generation source */
function Origin({ show = true }: { show?: boolean }) {
  if (!show) return null;
  const cfg = HANDLE_CONFIG[HandleSemantic.ORIGIN];
  return (
    <NodePortBase
      type="target"
      position={Position.Top}
      id={HANDLE_IDS.ORIGIN}
      className={cfg.color}
      isConnectable={false}
    />
  );
}

/** PRODUCT Handle - Bottom purple, indicates what this node produces (non-interactive) */
function Product() {
  const cfg = HANDLE_CONFIG[HandleSemantic.PRODUCT];
  return (
    <NodePortBase
      type="source"
      position={Position.Bottom}
      id={HANDLE_IDS.PRODUCT}
      className={cfg.color}
      isConnectable={false}
    />
  );
}

/** DATA_OUT Handle - Right green, node-level data output */
function Output({ id = HANDLE_IDS.OUTPUT, disabled = false }: { id?: string; disabled?: boolean }) {
  const cfg = HANDLE_CONFIG[HandleSemantic.DATA_OUT];
  return (
    <NodePortBase
      type="source"
      position={Position.Right}
      id={id}
      className={cfg.color}
      isConnectable={!disabled}
    />
  );
}

/** DATA_IN Handle - Left gray/blue, data input */
function Input({ id, connected = false }: { id: string; connected?: boolean }) {
  const cfg = HANDLE_CONFIG[HandleSemantic.DATA_IN];
  return (
    <NodePortBase
      type="target"
      position={Position.Left}
      id={id}
      className={connected ? cfg.colorConnected : cfg.color}
    />
  );
}

// Export component with sub-components
export const NodePort = Object.assign(NodePortBase, {
  Origin,
  Product,
  Output,
  Input,
});