import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useWorkflowStore } from '@/store/workflowStore';
import { SynniaNode } from '@/types/project';
import { toast } from 'sonner';
import { Save, RotateCcw, Copy } from 'lucide-react';
import { graphEngine } from '@/lib/engine/GraphEngine';

interface JsonEditorBlockProps {
    title: string;
    data: any;
    onSave: (newData: any) => void;
    readOnly?: boolean;
}

const JsonEditorBlock = ({ title, data, onSave, readOnly }: JsonEditorBlockProps) => {
    const [value, setValue] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        if (!isDirty && data) {
            setValue(JSON.stringify(data, null, 2));
        }
    }, [data, isDirty]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setValue(e.target.value);
        setIsDirty(true);
        setError(null);
    };

    const handleSave = () => {
        try {
            const parsed = JSON.parse(value);
            onSave(parsed);
            setIsDirty(false);
            toast.success(`${title} updated`);
        } catch (e: any) {
            setError(e.message);
            toast.error(`Invalid JSON in ${title}`);
        }
    };

    const handleReset = () => {
        setValue(JSON.stringify(data, null, 2));
        setIsDirty(false);
        setError(null);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(value);
        toast.success("Copied to clipboard");
    }

    return (
        <div className="flex flex-col h-1/2 min-h-0 border-b last:border-0 pb-4">
            <div className="flex items-center justify-between py-2 px-1">
                <Label className="text-xs font-bold text-muted-foreground uppercase">{title}</Label>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy} title="Copy JSON">
                        <Copy className="h-3 w-3" />
                    </Button>
                    {!readOnly && isDirty && (
                        <>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleReset} title="Reset Changes">
                                <RotateCcw className="h-3 w-3" />
                            </Button>
                            <Button size="sm" className="h-6 text-xs px-2" onClick={handleSave}>
                                <Save className="h-3 w-3 mr-1" /> Apply
                            </Button>
                        </>
                    )}
                </div>
            </div>
            <div className="flex-1 relative min-h-0">
                <Textarea
                    value={value}
                    onChange={handleChange}
                    className={`h-full font-mono text-[10px] resize-none border-0 rounded-none bg-muted/30 focus-visible:ring-0 p-2 leading-relaxed ${error ? 'border-2 border-destructive' : ''}`}
                    spellCheck={false}
                    readOnly={readOnly}
                />
                {error && (
                    <div className="absolute bottom-2 right-2 left-2 bg-destructive/90 text-destructive-foreground text-[10px] p-1.5 rounded shadow-lg backdrop-blur-sm truncate">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
};

interface DebugInspectorProps {
    nodeId: string;
}

export const DebugInspector = ({ nodeId }: DebugInspectorProps) => {
    const node = useWorkflowStore(state => state.nodes.find(n => n.id === nodeId));
    const asset = useWorkflowStore(state => node?.data.assetId ? state.assets[node.data.assetId] : null);

    if (!node) return <div className="p-4 text-xs text-muted-foreground">No node selected</div>;

    const handleNodeSave = (newNode: SynniaNode) => {
        if (newNode.id !== node.id) {
            toast.error("Cannot change Node ID via Debugger");
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
        <div className="flex flex-col h-full">
            <JsonEditorBlock
                title={`Node (${node.type})`}
                data={node}
                onSave={handleNodeSave}
            />
            {asset && (
                <JsonEditorBlock
                    title={`Asset (${asset.valueType})`}
                    data={fullAssetData}
                    onSave={handleAssetSave}
                />
            )}
        </div>
    );
};
