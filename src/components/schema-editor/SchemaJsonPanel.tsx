// SchemaJsonPanel - Right panel with SynniaEditor

import { useEffect, useState, useCallback } from 'react';
import { PanelProps } from './types';
import { SynniaEditor } from '@/components/ui/synnia-editor';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

export function SchemaJsonPanel({ schema, onChange, className }: PanelProps) {
    const [jsonText, setJsonText] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Sync schema -> text (only when schema changes from outside, not local edits)
    // We use a ref or simplified approach: re-sync if schema object ref changes
    // But since we want bidirectional sync, we need to be careful not to overwrite user typing.
    // The parent dialog handles exact sync logic better usually, but here:

    // Simple approach: When schema prop updates, update text if it doesn't match parsed current text
    useEffect(() => {
        try {
            const currentParsed = jsonText ? JSON.parse(jsonText) : null;
            // Deep compare is expensive, but for UI responsiveness we can just check stringify
            // Optimization: checking if stringified version matches to avoid cursor jump is handled by SynniaEditor usually if value matches
            const incomingJson = JSON.stringify(schema, null, 2);
            if (incomingJson !== jsonText && incomingJson !== JSON.stringify(currentParsed, null, 2)) {
                setJsonText(incomingJson);
                setError(null);
            }
        } catch {
            // Ignore parse errors in local text checking
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schema]);

    const handleChange = useCallback((val: string) => {
        setJsonText(val);
        try {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) {
                onChange(parsed);
                setError(null);
            } else {
                setError('Schema must be an array');
            }
        } catch (e) {
            // Valid JSON editing in progress, don't update parent yet
            // But we might want to set error state
            // SynniaEditor handles basic syntax errors visually
        }
    }, [onChange]);

    return (
        <div className={cn("flex flex-col h-full min-h-0", className)}>
            <div className="flex-1 min-h-0 relative">
                <SynniaEditor
                    value={jsonText}
                    onChange={handleChange}
                    mode="json"
                    className="h-full border-0 rounded-none bg-muted/50"
                    hideToolbar={true}
                    hideBorder={true}
                />

                {error && (
                    <div className="absolute bottom-4 right-4 bg-destructive/90 text-destructive-foreground text-xs px-3 py-1.5 rounded-md flex items-center gap-2 shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
}
