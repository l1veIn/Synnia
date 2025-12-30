/**
 * AdvancedTab - Raw JSON viewing and advanced settings
 * Allows users to inspect the raw asset configuration
 */

import { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import type { RecordAsset } from '@/types/assets';

export interface AdvancedTabProps {
    asset: RecordAsset;
}

export function AdvancedTab({ asset }: AdvancedTabProps) {
    const [copied, setCopied] = useState(false);

    const jsonString = useMemo(() => {
        return JSON.stringify(asset, null, 2);
    }, [asset]);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(jsonString);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="advanced-tab flex flex-col h-full p-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                    Raw Asset Configuration
                </h3>
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                    {copied ? (
                        <Check className="w-4 h-4 text-green-500" />
                    ) : (
                        <Copy className="w-4 h-4" />
                    )}
                </Button>
            </div>
            <ScrollArea className="flex-1 rounded-md border bg-muted/50">
                <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
                    {jsonString}
                </pre>
            </ScrollArea>
        </div>
    );
}
