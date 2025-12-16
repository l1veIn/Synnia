import { useAsset } from '@/hooks/useAsset';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, FileJson, FileType2, Braces } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { SynniaEditor } from '@/components/ui/synnia-editor';
import { AutoGenerateButton } from '@/components/ui/auto-generate-button';

export const TextNodeInspector = ({ assetId }: { assetId: string }) => {
    const { asset, setContent, setMetadata } = useAsset(assetId);
    const [localContent, setLocalContent] = useState('');

    // Sync content when asset changes
    useEffect(() => {
        if (asset) {
            // Always treat content as string for local editing
            const content = typeof asset.content === 'object'
                ? JSON.stringify(asset.content, null, 2)
                : String(asset.content || '');
            setLocalContent(content);
        }
    }, [asset?.content]);

    if (!asset) return <div className="p-4 text-xs text-muted-foreground">Asset Not Found</div>;

    // Read editorMode from extra metadata
    const editorMode = (asset.metadata?.extra?.editorMode as string) || 'plain';

    const handleModeChange = (mode: string) => {
        setMetadata({ extra: { ...asset.metadata.extra, editorMode: mode } });
    };

    const handleEditorChange = (val: string) => {
        setLocalContent(val);
        // Only update local state. Explicit save required to update Asset Store.
    };

    const handleFormatJson = () => {
        try {
            const parsed = JSON.parse(localContent);
            const formatted = JSON.stringify(parsed, null, 2);
            setLocalContent(formatted);
            // Format does not auto-save, user must click save
            toast.success("JSON Formatted");
        } catch (e) {
            toast.error("Invalid JSON");
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="px-4 py-2 border-b bg-muted/30">
                <Tabs value={editorMode} onValueChange={handleModeChange} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 h-9">
                        <TabsTrigger value="plain" className="text-xs h-7">
                            <FileText className="h-3 w-3 mr-2" /> Plain
                        </TabsTrigger>
                        <TabsTrigger value="markdown" className="text-xs h-7">
                            <FileType2 className="h-3 w-3 mr-2" /> MD
                        </TabsTrigger>
                        <TabsTrigger value="json" className="text-xs h-7">
                            <FileJson className="h-3 w-3 mr-2" /> JSON
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <div className="flex-1 p-4 min-h-0 flex flex-col space-y-4">
                <div className="space-y-2 flex-1 flex flex-col min-h-0 relative">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Content</Label>
                        <div className="flex items-center gap-1">
                            <AutoGenerateButton
                                mode={editorMode === 'json' ? 'json-complete' : 'text'}
                                existingContent={localContent}
                                onGenerate={(content) => {
                                    const newContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
                                    setLocalContent(newContent);
                                }}
                                placeholder={editorMode === 'json' ? 'Describe the JSON structure...' : 'Describe what to write...'}
                            />
                            {editorMode === 'json' && (
                                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={handleFormatJson} title="Format JSON">
                                    <Braces className="h-3 w-3 mr-1" /> Format
                                </Button>
                            )}
                        </div>
                    </div>

                    <SynniaEditor
                        value={localContent}
                        onChange={handleEditorChange}
                        mode={editorMode as any}
                        className="flex-1 border-0"
                        title={asset.metadata?.name || 'Text Asset'}
                        onSave={(val) => {
                            setContent(val);
                            toast.success("Saved");
                        }}
                    />
                </div>

                <div className="text-[10px] text-muted-foreground font-mono shrink-0">
                    ID: {asset.id}
                </div>
            </div>
        </div>
    );
};


