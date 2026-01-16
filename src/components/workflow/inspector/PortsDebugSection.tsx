import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkflowStore } from '@/store/workflowStore';
import { behaviorRegistry } from '@core/engine/BehaviorRegistry';
import { portRegistry } from '@core/engine/ports';
import { useFieldConnections } from '@/hooks/useFieldConnections';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { ChevronRight, ChevronDown } from 'lucide-react';
import ReactJson from 'react-json-view';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PortsDebugSectionProps {
    nodeId: string;
    defaultOpen?: boolean;
}

export const PortsDebugSection = ({ nodeId, defaultOpen = false }: PortsDebugSectionProps) => {
    const { t } = useTranslation('inspector');
    const { resolvedTheme } = useTheme();
    const node = useWorkflowStore(state => state.nodes.find(n => n.id === nodeId));
    const asset = useWorkflowStore(state => node?.data.assetId ? state.assets[node.data.assetId] : null);
    const [isOpen, setIsOpen] = useState(defaultOpen);

    // Get Inputs
    const { connections } = useFieldConnections(nodeId);

    // Get Outputs
    const outputPorts = useMemo(() => {
        if (!node) return [];
        // The asset can be null/undefined for non-asset nodes or invalid states, so we cast if necessary or handle it
        return portRegistry.getOutputPorts(node, asset || null);
    }, [node, asset]);

    const outputValues = useMemo(() => {
        if (!node || !outputPorts.length) return {};
        const behavior = behaviorRegistry.get(node.type);
        const values: Record<string, any> = {};

        outputPorts.forEach((port: any) => {
            try {
                // resolveOutput is optional on NodeBehavior
                if (behavior?.resolveOutput) {
                    values[port.id] = behavior.resolveOutput(node, asset, port.id) ?? 'undefined';
                } else {
                    values[port.id] = '<No Resolver>';
                }
            } catch (e: any) {
                values[port.id] = `<Error: ${e.message}>`;
            }
        });
        return values;
    }, [node, asset, outputPorts]);

    const rjvTheme = resolvedTheme === 'dark' ? 'monokai' : 'rjv-default';
    const bgClass = resolvedTheme === 'dark' ? 'bg-[#272822]' : 'bg-white';

    if (!node) return null;

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full space-y-2">
            <Card className="rounded-md border shadow-sm overflow-hidden">
                <CardHeader className="p-0">
                    <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors select-none">
                            <div className="flex items-center gap-2">
                                {isOpen ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                                <Label className="text-sm font-semibold cursor-pointer">Ports (Inputs/Outputs)</Label>
                            </div>
                        </div>
                    </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                    <CardContent className="p-0 border-t divide-y">

                        {/* Inputs Section */}
                        <div className="p-3">
                            <Label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Inputs</Label>
                            {connections.size === 0 ? (
                                <div className="text-xs text-muted-foreground italic">No input connections</div>
                            ) : (
                                <div className="space-y-3">
                                    {Array.from(connections.entries()).map(([key, info]) => (
                                        <div key={key} className="space-y-1">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-mono text-primary">{key}</span>
                                                <span className="text-muted-foreground truncate max-w-[150px]">
                                                    ← {info.sourceNodeTitle} ({info.sourcePortId})
                                                </span>
                                            </div>
                                            <div className={cn("border rounded overflow-hidden", bgClass)}>
                                                <div className="p-2 text-[10px]">
                                                    <ReactJson
                                                        src={info.value}
                                                        name={null}
                                                        theme={rjvTheme}
                                                        collapsed={1}
                                                        collapseStringsAfterLength={30}
                                                        displayDataTypes={false}
                                                        enableClipboard={false}
                                                        style={{ backgroundColor: 'transparent' }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Outputs Section */}
                        <div className="p-3">
                            <Label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Outputs</Label>
                            {outputPorts.length === 0 ? (
                                <div className="text-xs text-muted-foreground italic">No output ports</div>
                            ) : (
                                <div className="space-y-3">
                                    {outputPorts.map((port: any) => (
                                        <div key={port.id} className="space-y-1">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-mono text-purple-500">{port.id}</span>
                                                <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">
                                                    {port.dataType}
                                                </span>
                                            </div>
                                            <div className={cn("border rounded overflow-hidden", bgClass)}>
                                                <div className="p-2 text-[10px]">
                                                    <ReactJson
                                                        src={outputValues[port.id]}
                                                        name={null}
                                                        theme={rjvTheme}
                                                        collapsed={1}
                                                        collapseStringsAfterLength={30}
                                                        displayDataTypes={false}
                                                        enableClipboard={false}
                                                        style={{ backgroundColor: 'transparent' }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
};
