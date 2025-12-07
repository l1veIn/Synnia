import { Asset, FormAssetContent, isFormAsset } from '@/types/assets';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SchemaBuilder } from './SchemaBuilder';
import { FormRenderer } from './FormRenderer';
import { useState, useEffect } from 'react';

interface EditorProps {
    asset: Asset;
    onUpdate: (content: any) => void;
}

export function FormAssetEditor({ asset, onUpdate }: EditorProps) {
    const [activeTab, setActiveTab] = useState('values');

    // Init Logic: Ensure structure exists
    useEffect(() => {
        if (!isFormAsset(asset.content)) {
            // Upgrade legacy JSON or create new
            const legacyValues = typeof asset.content === 'object' ? asset.content : {};
            
            // Init with empty schema + existing values
             const initContent: FormAssetContent = {
                schema: [],
                values: legacyValues || {}
            };
            
            // Only update if it's totally wrong to avoid loop
            // We check if it is NOT a form asset (which we already did)
            // But we must be careful not to trigger infinite loop if onUpdate changes prop 'asset' immediately
            // Since we rely on 'asset.content', if it's not valid, we fix it once.
            if (JSON.stringify(asset.content) !== JSON.stringify(initContent)) {
                 onUpdate(initContent);
            }
        }
    }, [asset.content, onUpdate]);

    if (!isFormAsset(asset.content)) {
         return <div className="text-xs text-muted-foreground p-4">Initializing Form Structure...</div>;
    }

    const { schema, values } = asset.content;

    const handleSchemaUpdate = (newSchema: any) => {
        onUpdate({
            schema: newSchema,
            values: values // Preserve values
        });
    };

    const handleValuesUpdate = (newValues: any) => {
        onUpdate({
            schema: schema,
            values: newValues
        });
    };

    return (
        <div className="flex flex-col h-full">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
                <div className="px-4 pt-2 shrink-0">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="values">Values</TabsTrigger>
                        <TabsTrigger value="schema">Schema</TabsTrigger>
                    </TabsList>
                </div>
                
                <TabsContent value="values" className="flex-1 p-4 min-h-0 overflow-y-auto">
                    <FormRenderer 
                        schema={schema} 
                        values={values} 
                        onChange={handleValuesUpdate} 
                    />
                </TabsContent>
                
                <TabsContent value="schema" className="flex-1 p-4 min-h-0 overflow-y-auto">
                    <SchemaBuilder 
                        schema={schema} 
                        onChange={handleSchemaUpdate} 
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}