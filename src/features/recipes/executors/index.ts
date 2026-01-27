// Recipe Executor System
// Core executor for Recipe nodes
//
// DEPRECATED: This file re-exports for backward compatibility.
// New code should import from @features/executors instead.

// Re-export AgentExecutor as ModelExecutor for backward compatibility
export { AgentExecutor as ModelExecutor } from '@features/executors/agent';

// Output strategy utilities
export { inferValueType, isSchemaCompatible, determineOutputAction } from './outputStrategy';
export type { OutputAction } from './outputStrategy';
