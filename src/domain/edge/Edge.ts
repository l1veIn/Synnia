export type EdgeType = 'value' | 'product';

export type MappingSpec = {
    mode: 'smart' | 'explicit';
    rules?: Array<{
        sourcePattern: string;
        targetKey: string;
        transform?: 'firstMatch';
    }>;
};

export interface Edge {
    id: string;
    type: EdgeType;
    sourceNodeId: string;
    targetNodeId: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    mappingSpec?: MappingSpec;
    uiType?: string;
}
