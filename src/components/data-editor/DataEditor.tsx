import { useState, useMemo } from 'react';
import { DataEditorProps, NavigationItem } from './types';
import { TableView } from './TableView';
import { FormView } from './FormView';
import { Button } from '@/components/ui/button';
import { ChevronRight, Home } from 'lucide-react';
import { FieldDefinition } from '@/types/assets';
import { cn } from '@/lib/utils';

export function DataEditor({ data, schema, onChange, className }: DataEditorProps) {
    // Navigation Stack
    // Each item represents a context we are viewing.
    // Root is implicit.
    const [navStack, setNavStack] = useState<NavigationItem[]>([]);

    // Helper to resolve current path
    const currentPath = useMemo(() => {
        if (navStack.length === 0) return [];
        return navStack[navStack.length - 1].path;
    }, [navStack]);

    // Helper to resolve schema at current level
    const currentSchema = useMemo(() => {
        if (navStack.length === 0) return schema;
        return navStack[navStack.length - 1].schema;
    }, [navStack, schema]);

    // Helper to resolve data at current level
    const currentData = useMemo(() => {
        let current = data;

        // Root is always data.
        if (navStack.length === 0) return current;

        // Traverse using the accumulated path from stack items? 
        // No, currentPath logic needs to be robust. 
        // Just re-traverse from root using the full path of the tip.
        // Wait, navStack item 'path' stores the RELATIVE path or FULL path?
        // Let's store FULL path to keep it simple.

        const path = navStack[navStack.length - 1].path;
        for (const key of path) {
            if (current === undefined || current === null) return undefined;
            current = current[key];
        }
        return current;
    }, [data, navStack]);

    // Determine View Type
    const viewType = useMemo(() => {
        if (navStack.length > 0) {
            return navStack[navStack.length - 1].type;
        }
        // Root detection
        return Array.isArray(data) ? 'array' : 'object';
    }, [navStack, data]);

    // Handlers
    const handleNavigate = (path: (string | number)[] | string | number, nextSchema: FieldDefinition[], fieldType: 'array' | 'object') => {
        const step = Array.isArray(path) ? path : [path];
        const parentPath = navStack.length > 0 ? navStack[navStack.length - 1].path : [];
        const fullPath = [...parentPath, ...step];

        // Use explicit fieldType from caller (based on schema definition)
        setNavStack(prev => [...prev, {
            path: fullPath,
            label: String(step[step.length - 1]),
            schema: nextSchema,
            type: fieldType
        }]);
    };

    const handleUpdate = (newValue: any) => {
        if (navStack.length === 0) {
            onChange(newValue);
            return;
        }

        // Deep update
        const fullPath = navStack[navStack.length - 1].path;

        // We need to clone root data and set value at path
        const newData = structuredClone(data); // standard deep clone
        let current = newData;
        for (let i = 0; i < fullPath.length - 1; i++) {
            const key = fullPath[i];
            current = current[key];
        }
        const lastKey = fullPath[fullPath.length - 1];
        current[lastKey] = newValue;

        onChange(newData);
    };

    const popStack = (index?: number) => {
        if (index === undefined) {
            setNavStack(prev => prev.slice(0, -1));
        } else {
            setNavStack(prev => prev.slice(0, index + 1));
        }
    };

    return (
        <div className={cn("flex flex-col h-full", className)}>
            {/* Breadcrumbs */}
            <div className="flex items-center gap-1.5 p-2 bg-muted/20 border-b text-xs overflow-x-auto min-h-[40px]">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setNavStack([])}
                    disabled={navStack.length === 0}
                >
                    <Home className="h-3 w-3" />
                </Button>

                {navStack.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 shrink-0">
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "h-6 px-2 text-xs",
                                idx === navStack.length - 1 && "bg-background shadow-sm font-medium"
                            )}
                            onClick={() => idx < navStack.length - 1 && popStack(idx)}
                        >
                            {/* Make label friendlier if it's an index */}
                            {typeof item.path[item.path.length - 1] === 'number'
                                ? `Item ${item.path[item.path.length - 1]}`
                                : item.label}
                        </Button>
                    </div>
                ))}
            </div>

            {/* Content View */}
            <div className="flex-1 min-h-0 bg-background">
                {viewType === 'array' ? (
                    <TableView
                        data={currentData}
                        schema={currentSchema}
                        onChange={handleUpdate}
                        onNavigate={handleNavigate}
                        path={currentPath}
                    />
                ) : (
                    <FormView
                        data={currentData}
                        schema={currentSchema}
                        onChange={handleUpdate}
                        onNavigate={handleNavigate}
                        path={currentPath}
                    />
                )}
            </div>

            {/* Debug Info (Optional) */}
            {/* <div className="text-[10px] text-muted-foreground p-1 border-t">
                Path: {currentPath.join(' > ')} | Type: {viewType}
            </div> */}
        </div>
    );
}

// Polyfill for structuredClone if needed (though modern browsers have it)
// or just use JSON parse/stringify for safety
function deepClone(obj: any) {
    if (typeof structuredClone === 'function') return structuredClone(obj);
    return JSON.parse(JSON.stringify(obj));
}
