import { memo, useEffect, useState, useMemo, useCallback } from 'react';
import { NodeProps, NodeResizer, useUpdateNodeInternals } from '@xyflow/react';
import { SynniaNode } from '@/types/project';
import { NodeShell } from '../primitives/NodeShell';
import { NodeHeader, NodeHeaderAction } from '../primitives/NodeHeader';
import { NodePort } from '../primitives/NodePort';
import { useNode } from '@/hooks/useNode';
import { useAsset } from '@/hooks/useAsset';
import { List, Trash2, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Import types and views
import type {
    SelectorContent,
    SelectorOption,
} from './types';
import {
    DEFAULT_OPTION_SCHEMA,
    DEFAULT_CARD_LAYOUT,
    detectFieldMapping,
} from './types';
import { viewRegistry, BulkActions } from './views';

// Re-export for backward compatibility
export type { SelectorOption, SelectorContent as SelectorAssetContent } from './types';
export { DEFAULT_OPTION_SCHEMA } from './types';

// --- Node Component ---
export const SelectorNode = memo((props: NodeProps<SynniaNode>) => {
    const { id, selected } = props;
    const { state, actions } = useNode(id);
    const assetId = state.node?.data.assetId;
    const { updateConfig } = useAsset(assetId);
    const updateNodeInternals = useUpdateNodeInternals();

    useEffect(() => {
        updateNodeInternals(id);
    }, [state.isCollapsed, id, updateNodeInternals]);

    // Get content with full defaults
    const content: SelectorContent = useMemo(() => {
        const raw = state.asset?.value;
        const config = (state.asset?.config as any) || {};
        const extra = config.extra || {};
        const schema = config.schema ?? DEFAULT_OPTION_SCHEMA;

        // Parse options
        let options: SelectorOption[] = [];
        if (Array.isArray(raw)) {
            options = raw.map((item: any, i: number) => ({
                id: item.id || `opt-${i}`,
                ...item,
            }));
        }

        // Auto-detect field mapping if not set
        const detectedMapping = detectFieldMapping(schema);
        const userMapping = extra.fieldMapping || {};

        return {
            mode: extra.mode ?? 'multi',
            viewMode: extra.viewMode ?? 'list',
            showSearch: extra.showSearch ?? true,
            showBulkActions: extra.showBulkActions ?? false,
            schema,
            options,
            selected: extra.selected || [],
            fieldMapping: { ...detectedMapping, ...userMapping },
            cardLayout: { ...DEFAULT_CARD_LAYOUT, ...extra.cardLayout },
        };
    }, [state.asset?.value, state.asset?.config]);

    // Local search state
    const [searchQuery, setSearchQuery] = useState('');

    // Filter options by search
    const filteredOptions = useMemo(() => {
        if (!searchQuery.trim()) return content.options;
        const query = searchQuery.toLowerCase();
        return content.options.filter(opt => {
            // Search in all string fields
            for (const field of content.schema) {
                const val = opt[field.key];
                if (typeof val === 'string' && val.toLowerCase().includes(query)) {
                    return true;
                }
            }
            return opt.id.toLowerCase().includes(query);
        });
    }, [content.options, content.schema, searchQuery]);

    // Toggle option selection
    const handleSelect = useCallback((optionId: string) => {
        if (state.isReference) return;

        let newSelected: string[];
        if (content.mode === 'single') {
            newSelected = content.selected.includes(optionId) ? [] : [optionId];
        } else {
            newSelected = content.selected.includes(optionId)
                ? content.selected.filter(id => id !== optionId)
                : [...content.selected, optionId];
        }

        // Update config.extra with new selected
        const config = (state.asset?.config as any) || {};
        updateConfig({
            ...config,
            extra: {
                ...config.extra,
                selected: newSelected,
            },
        });
    }, [state.isReference, content.mode, content.selected, state.asset?.config, updateConfig]);

    // Bulk actions
    const handleSelectAll = useCallback(() => {
        const allIds = content.options.map(o => o.id);
        const config = (state.asset?.config as any) || {};
        updateConfig({
            ...config,
            extra: { ...config.extra, selected: allIds },
        });
    }, [content.options, state.asset?.config, updateConfig]);

    const handleSelectNone = useCallback(() => {
        const config = (state.asset?.config as any) || {};
        updateConfig({
            ...config,
            extra: { ...config.extra, selected: [] },
        });
    }, [state.asset?.config, updateConfig]);

    const handleInvertSelection = useCallback(() => {
        const currentSet = new Set(content.selected);
        const inverted = content.options.filter(o => !currentSet.has(o.id)).map(o => o.id);
        const config = (state.asset?.config as any) || {};
        updateConfig({
            ...config,
            extra: { ...config.extra, selected: inverted },
        });
    }, [content.options, content.selected, state.asset?.config, updateConfig]);

    // Get view component - memoized to avoid creating during render
    const ViewComponent = viewRegistry[content.viewMode] || viewRegistry.list;

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

            {/* Origin Handle */}
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
                    {/* Toolbar: Search + Bulk Actions */}
                    {(content.showSearch || content.showBulkActions) && content.viewMode !== 'combobox' && (
                        <div className="flex items-center justify-between gap-2 shrink-0 px-1 pt-1 pb-2">
                            {content.showSearch && (
                                <div className="relative flex-1 min-w-0">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70" />
                                    <Input
                                        placeholder="Search options..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="h-8 pl-8 pr-2 w-full text-xs bg-muted/30 border-transparent hover:bg-muted/50 focus:bg-background transition-colors rounded-md"
                                    />
                                </div>
                            )}

                            {content.showBulkActions && content.mode === 'multi' && (
                                <BulkActions
                                    onSelectAll={handleSelectAll}
                                    onSelectNone={handleSelectNone}
                                    onInvertSelection={handleInvertSelection}
                                    selectedCount={content.selected.length}
                                    totalCount={content.options.length}
                                    mode={content.mode}
                                    className="shrink-0"
                                />
                            )}
                        </div>
                    )}

                    {/* View Content */}
                    <div className={cn(
                        'flex-1 min-h-0 overflow-y-auto',
                        content.viewMode !== 'combobox' && 'pr-1' // Scrollbar padding for non-combobox
                    )}>
                        <ViewComponent
                            options={filteredOptions}
                            selected={content.selected}
                            onSelect={handleSelect}
                            mode={content.mode}
                            schema={content.schema}
                            fieldMapping={content.fieldMapping}
                            searchQuery={searchQuery}
                            isDisabled={state.isReference}
                            cardLayout={content.cardLayout}
                        />
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground shrink-0 pt-1 border-t">
                        <span>{content.selected.length} selected</span>
                        <span className="opacity-50 capitalize">{content.viewMode}</span>
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
