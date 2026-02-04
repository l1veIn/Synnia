import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useWorkflowStore } from '@/store/workflowStore';
import { SynniaNode } from '@/types/project';
import { toast } from 'sonner';
import { Save, RotateCcw, Copy, ChevronRight, ChevronDown } from 'lucide-react';
import { graphEngine } from '@core/engine/GraphEngine';
import { useTranslation } from 'react-i18next';
import JsonView from '@uiw/react-json-view';
import { lightTheme } from '@uiw/react-json-view/light';
import { darkTheme } from '@uiw/react-json-view/dark';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { PortsDebugSection } from './PortsDebugSection';
import { resolveNodeAssetId } from '@core/utils/nodeAsset';

interface JsonEditorBlockProps {
    title: string;
    data: any;
    onSave: (newData: any) => void;
    readOnly?: boolean;
    defaultOpen?: boolean;
}

const JsonEditorBlock = ({ title, data, onSave, readOnly, defaultOpen = true }: JsonEditorBlockProps) => {
    const { t } = useTranslation('inspector');
    const { resolvedTheme } = useTheme();
    const [jsonData, setJsonData] = useState<any>(data);
    const [isDirty, setIsDirty] = useState(false);
    const [isOpen, setIsOpen] = useState(defaultOpen);

    useEffect(() => {
        if (!isDirty && data) {
            setJsonData(data);
        }
    }, [data, isDirty]);

    const handleEdit = (edit: any) => {
        setJsonData(edit.updated_src);
        setIsDirty(true);
    };

    const handleSave = (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            onSave(jsonData);
            setIsDirty(false);
            toast.success(t('debug.updated', { title }));
        } catch (e: any) {
            toast.error(t('debug.saveFailed', { title }));
        }
    };

    const handleReset = (e: React.MouseEvent) => {
        e.stopPropagation();
        setJsonData(data);
        setIsDirty(false);
    };

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(JSON.stringify(jsonData, null, 2));
        toast.success(t('debug.copied'));
    }


    const bgClass = resolvedTheme === 'dark' ? 'bg-[#272822]' : 'bg-white';

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
                                <Label className="text-sm font-semibold cursor-pointer">{title}</Label>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy} title={t('debug.copyJson')}>
                                    <Copy className="h-3.5 w-3.5" />
                                </Button>
                                {!readOnly && isDirty && (
                                    <>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={handleReset} title={t('debug.resetChanges')}>
                                            <RotateCcw className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button size="sm" className="h-7 text-xs px-2 ml-1" onClick={handleSave}>
                                            <Save className="h-3.5 w-3.5 mr-1" /> {t('debug.apply')}
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                    <CardContent className="p-0 border-t">
                        <div className={cn("relative min-h-[100px] max-h-[500px]", bgClass)}>
                            <ScrollArea className="h-full w-full max-h-[500px]">
                                <div className="p-4 text-xs">
                                    <JsonView
                                        value={jsonData}
                                        style={resolvedTheme === 'dark' ? darkTheme : lightTheme}
                                        collapsed={2}
                                        displayDataTypes={false}
                                    />
                                </div>
                            </ScrollArea>
                        </div>
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
};

interface DebugInspectorProps {
    nodeId: string;
}

export const DebugInspector = ({ nodeId }: DebugInspectorProps) => {
    const { t } = useTranslation('inspector');
    const node = useWorkflowStore(state => state.nodes.find(n => n.id === nodeId));
    const assetId = resolveNodeAssetId(node);
    const asset = useWorkflowStore(state => assetId ? state.assets[assetId] : null);

    if (!node) return <div className="p-4 text-xs text-muted-foreground">{t('debug.noNode')}</div>;

    const handleNodeSave = (newNode: SynniaNode) => {
        if (newNode.id !== node.id) {
            toast.error(t('debug.cannotChangeId'));
            return;
        }
        graphEngine.updateNode(node.id, newNode);
    };

    const handleAssetSave = (newAssetData: any) => {
        if (!asset) return;

        if (newAssetData.value !== undefined) {
            graphEngine.assets.update(asset.id, newAssetData.value);
        }

        if (newAssetData.sys) {
            graphEngine.assets.updateSys(asset.id, newAssetData.sys);
        }
    };

    const fullAssetData = asset;

    return (
        <ScrollArea className="h-full">
            <div className="flex flex-col gap-4 p-4 pb-20">
                <JsonEditorBlock
                    title={`Node (${node.type})`}
                    data={node}
                    onSave={handleNodeSave}
                    defaultOpen={false}
                />

                {asset && (
                    <JsonEditorBlock
                        title={`Asset (${asset.valueType})`}
                        data={fullAssetData}
                        onSave={handleAssetSave}
                        defaultOpen={false}
                    />
                )}

                <PortsDebugSection nodeId={nodeId} defaultOpen={true} />
            </div>
        </ScrollArea>
    );
};
