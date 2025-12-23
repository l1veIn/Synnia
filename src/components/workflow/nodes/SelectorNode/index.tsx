import { memo, useEffect, useState, useMemo, useCallback } from 'react';
import { NodeProps, NodeResizer, useUpdateNodeInternals } from '@xyflow/react';
import { SynniaNode } from '@/types/project';
import { NodeShell } from '../primitives/NodeShell';
import { NodeHeader, NodeHeaderAction } from '../primitives/NodeHeader';
import { NodePort } from '../primitives/NodePort';
import { useNode } from '@/hooks/useNode';
import { List, Trash2, ChevronDown, ChevronUp, Check, Search } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';



// Import types for local use
import { SelectorOption, SelectorAssetContent, DEFAULT_OPTION_SCHEMA } from './types';

// Re-export types for backward compatibility
export type { SelectorOption, SelectorAssetContent } from './types';
export { DEFAULT_OPTION_SCHEMA } from './types';

// --- Node Component ---
export const SelectorNode = memo((props: NodeProps<SynniaNode>) => {
    const { id, selected } = props;
    const { state, actions } = useNode(id);
    const updateNodeInternals = useUpdateNodeInternals();
    const [expandedOptions, setExpandedOptions] = useState<Set<string>>(new Set());

    useEffect(() => {
        updateNodeInternals(id);
    }, [state.isCollapsed, id, updateNodeInternals]);

    // Get content with defaults - now from asset.value
    const content: SelectorAssetContent = useMemo(() => {
        const raw = (state.asset?.value as SelectorAssetContent) || {};
        return {
            mode: raw.mode ?? 'multi',
            showSearch: raw.showSearch ?? true,
            optionSchema: raw.optionSchema ?? DEFAULT_OPTION_SCHEMA,
            options: raw.options ?? [],
            selected: raw.selected ?? [],
        };
    }, [state.asset?.value]);

    // Local search state
    const [searchQuery, setSearchQuery] = useState('');

    // Get display label for an option (first string field in schema, or id)
    const getOptionLabel = useCallback((option: SelectorOption): string => {
        const schema = content.optionSchema;
        // Find first string field value
        for (const field of schema) {
            if (field.type === 'string' && option[field.key]) {
                return String(option[field.key]);
            }
        }
        return option.id;
    }, [content.optionSchema]);

    // Filter options by search
    const filteredOptions = useMemo(() => {
        if (!searchQuery.trim()) return content.options;
        const query = searchQuery.toLowerCase();
        return content.options.filter(opt => {
            // Search in all string fields
            for (const field of content.optionSchema) {
                const val = opt[field.key];
                if (typeof val === 'string' && val.toLowerCase().includes(query)) {
                    return true;
                }
            }
            return opt.id.toLowerCase().includes(query);
        });
    }, [content.options, content.optionSchema, searchQuery]);

    // Toggle option selection
    const toggleOption = (optionId: string) => {
        if (state.isReference) return;

        let newSelected: string[];
        if (content.mode === 'single') {
            newSelected = content.selected.includes(optionId) ? [] : [optionId];
        } else {
            newSelected = content.selected.includes(optionId)
                ? content.selected.filter(id => id !== optionId)
                : [...content.selected, optionId];
        }

        actions.updateContent({ ...content, selected: newSelected });
    };

    // Toggle option expansion
    const toggleExpand = (optionId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedOptions(prev => {
            const next = new Set(prev);
            if (next.has(optionId)) {
                next.delete(optionId);
            } else {
                next.add(optionId);
            }
            return next;
        });
    };

    // Check if option has extra data to show
    const hasExtraData = useMemo(() => {
        return content.optionSchema.length > 1;
    }, [content.optionSchema]);

    return (
        <NodeShell
            selected={selected}
            state={state.executionState as any}
            className={state.shellClassName}
            dockedTop={state.isDockedTop}
            dockedBottom={state.isDockedBottom}
        >
            <NodeResizer
                isVisible={selected && state.isResizable}
                minWidth={200}
                minHeight={100}
                color="#3b82f6"
                handleStyle={{ width: 8, height: 8, borderRadius: 4 }}
                onResizeEnd={(_e, params) => actions.resize(params.width, params.height)}
            />

            {/* Origin Handle - shown when this is a recipe product */}
            <NodePort.Origin show={state.hasProductHandle} />

            <NodeHeader
                className={state.headerClassName}
                icon={<List className="h-4 w-4" />}
                title={state.title}
                actions={
                    <>
                        <NodeHeaderAction onClick={actions.toggle} title={state.isCollapsed ? 'Expand' : 'Collapse'}>
                            {state.isCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </NodeHeaderAction>
                        <NodeHeaderAction onClick={(e) => { e.stopPropagation(); actions.remove(); }} title="Delete">
                            <Trash2 className="h-4 w-4 hover:text-destructive" />
                        </NodeHeaderAction>
                    </>
                }
            />

            {!state.isCollapsed && (
                <div className="p-2 flex-1 flex flex-col overflow-hidden gap-2">
                    {/* Search */}
                    {content.showSearch && (
                        <div className="relative shrink-0">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-7 pl-7 text-xs"
                            />
                        </div>
                    )}

                    {/* Options list */}
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
                        {filteredOptions.length === 0 ? (
                            <div className="text-xs text-muted-foreground text-center py-4">
                                {content.options.length === 0 ? 'No options. Configure in Inspector.' : 'No matches found'}
                            </div>
                        ) : (
                            filteredOptions.map((option) => {
                                const isSelected = content.selected.includes(option.id);
                                const isExpanded = expandedOptions.has(option.id);

                                return (
                                    <div key={option.id} className="border rounded overflow-hidden">
                                        {/* Option row */}
                                        <div
                                            className={cn(
                                                "flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-muted/50 transition-colors",
                                                isSelected && "bg-primary/10"
                                            )}
                                            onClick={() => toggleOption(option.id)}
                                        >
                                            {content.mode === 'multi' ? (
                                                <Checkbox checked={isSelected} className="h-3.5 w-3.5" />
                                            ) : (
                                                <div className={cn(
                                                    "h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center",
                                                    isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                                                )}>
                                                    {isSelected && <Check className="h-2 w-2 text-primary-foreground" />}
                                                </div>
                                            )}

                                            <span className="text-xs flex-1 truncate">{getOptionLabel(option)}</span>

                                            {/* Expand button when there's extra data */}
                                            {hasExtraData && (
                                                <button
                                                    className="p-0.5 hover:bg-muted rounded text-muted-foreground"
                                                    onClick={(e) => toggleExpand(option.id, e)}
                                                    title="Show details"
                                                >
                                                    <ChevronDown className={cn(
                                                        "h-3.5 w-3.5 transition-transform",
                                                        isExpanded && "rotate-180"
                                                    )} />
                                                </button>
                                            )}
                                        </div>

                                        {/* Expanded details */}
                                        {isExpanded && hasExtraData && (
                                            <div className="px-2 py-1.5 bg-muted/30 border-t space-y-1">
                                                {content.optionSchema.slice(1).map(field => {
                                                    const val = option[field.key];
                                                    if (val === undefined || val === null || val === '') return null;

                                                    return (
                                                        <div key={field.key} className="flex items-start gap-2 text-[10px]">
                                                            <span className="text-muted-foreground shrink-0">{field.label}:</span>
                                                            {field.widget === 'color' ? (
                                                                <div className="flex items-center gap-1">
                                                                    <div
                                                                        className="h-3 w-3 rounded border"
                                                                        style={{ backgroundColor: String(val) }}
                                                                    />
                                                                    <span className="font-mono">{String(val)}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="truncate">{String(val)}</span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground shrink-0 pt-1 border-t">
                        <span>{content.selected.length} selected</span>
                        <span className="opacity-50">{content.mode}</span>
                    </div>
                </div>
            )}

            {/* Collapsed preview */}
            {state.isCollapsed && (
                <div className="px-3 pb-2 text-xs text-muted-foreground">
                    {content.selected.length} of {content.options.length} selected
                </div>
            )}

            <NodePort.Output disabled={state.isDockedBottom} />
        </NodeShell>
    );
});
SelectorNode.displayName = 'SelectorNode';

// Re-export from separate files
export { Inspector } from './Inspector';
export { definition } from './definition';
export { SelectorNode as Node };

