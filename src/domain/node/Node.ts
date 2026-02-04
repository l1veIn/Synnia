import type { NodeMeta } from './NodeMeta';
import type { NodePresentation } from './NodePresentation';
import type { NodeSchema } from './NodeSchema';

export type NodeExecutionState = 'idle' | 'running' | 'paused' | 'error' | 'success' | 'stale';
export type NodeValueType = 'record' | 'array';

export interface Node {
    id: string;
    type: string;
    valueType: NodeValueType;
    data: any;
    schema?: NodeSchema;
    meta: NodeMeta;
    presentation: NodePresentation;
    executionState?: NodeExecutionState;
    errorMessage?: string;
    stateUpdatedAt?: number;
    isReference?: boolean;
    originalNodeId?: string;
}
