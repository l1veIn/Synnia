/**
 * AdvancedTab - Advanced Configuration & Tuning
 * Allows users to customize prompts and other advanced settings for this recipe instance.
 * Future sections may include execution parameters, history configuration, etc.
 */

import { useState } from 'react';
import { Button } from '@/presentation/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/presentation/components/ui/tabs';
import { RotateCcw } from 'lucide-react';
import { SynniaEditor } from '@/presentation/components/ui/synnia-editor';
import type { RecordAsset } from '@/domain/asset/types';
import type { RecipeDefinition } from '@/domain/recipe/manifest';
import { graphEngine } from '@/presentation/engine/GraphEngine';

export interface AdvancedTabProps {
    asset: RecordAsset;
    recipe?: RecipeDefinition | null;
}

export function AdvancedTab({ asset, recipe }: AdvancedTabProps) {
    // State is typed as string to allow for future configuration sections (e.g. 'config', 'history')
    const [activeTab, setActiveTab] = useState<string>('system');

    // Get prompts from asset.config.extra
    const extra = (asset.config as any)?.extra || {};
    const assetPrompt = extra.prompt || { system: '', user: '' };

    // Get original prompts from recipe manifest for reset (only for agent executor)
    const executor = recipe?.manifest?.executor;
    const manifestPrompt = (executor?.type === 'agent' && executor.prompt) || { system: '', user: '' };

    // Check if prompts have been modified
    const isSystemModified = assetPrompt.system !== manifestPrompt.system;
    const isUserModified = assetPrompt.user !== manifestPrompt.user;

    const handlePromptChange = (type: 'system' | 'user', value: string) => {
        const newPrompt = {
            ...assetPrompt,
            [type]: value,
        };

        // Update asset config
        graphEngine.assets.updateConfig(asset.id, {
            ...asset.config,
            extra: {
                ...extra,
                prompt: newPrompt,
            },
        });
    };

    const handleResetPrompt = (type: 'system' | 'user') => {
        handlePromptChange(type, manifestPrompt[type] || '');
    };

    return (
        <div className="advanced-tab flex flex-col h-full">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex flex-col h-full">
                <div className="px-4 pt-4 pb-2 border-b shrink-0">
                    <TabsList className="w-full">
                        <TabsTrigger value="system" className="flex-1 text-xs">
                            System Prompt
                            {isSystemModified && <span className="ml-1 text-primary">•</span>}
                        </TabsTrigger>
                        <TabsTrigger value="user" className="flex-1 text-xs">
                            User Prompt
                            {isUserModified && <span className="ml-1 text-primary">•</span>}
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="system" className="flex-1 min-h-0 p-4 pt-2 m-0">
                    <div className="flex flex-col h-full">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-muted-foreground">
                                {isSystemModified ? 'Modified' : 'Default from recipe'}
                            </span>
                            {isSystemModified && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleResetPrompt('system')}
                                    className="h-6 text-xs"
                                >
                                    <RotateCcw className="w-3 h-3 mr-1" />
                                    Reset
                                </Button>
                            )}
                        </div>
                        <div className="flex-1 min-h-0">
                            <SynniaEditor
                                value={assetPrompt.system || ''}
                                onChange={(val) => handlePromptChange('system', val)}
                                mode="markdown"
                                title="System Prompt"
                                className="h-full"
                            />
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="user" className="flex-1 min-h-0 p-4 pt-2 m-0">
                    <div className="flex flex-col h-full">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-muted-foreground">
                                {isUserModified ? 'Modified' : 'Default from recipe'}
                            </span>
                            {isUserModified && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleResetPrompt('user')}
                                    className="h-6 text-xs"
                                >
                                    <RotateCcw className="w-3 h-3 mr-1" />
                                    Reset
                                </Button>
                            )}
                        </div>
                        <div className="flex-1 min-h-0">
                            <SynniaEditor
                                value={assetPrompt.user || ''}
                                onChange={(val) => handlePromptChange('user', val)}
                                mode="markdown"
                                title="User Prompt"
                                className="h-full"
                            />
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
