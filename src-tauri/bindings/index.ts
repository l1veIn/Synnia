// Synnia TypeScript Bindings
// Auto-generated from Rust models via ts-rs
// Run `cargo test export_bindings` to regenerate

// Core Project Types
export type { SynniaProject } from './SynniaProject';
export type { ProjectMeta } from './ProjectMeta';
export type { Viewport } from './Viewport';
export type { Graph } from './Graph';

// Asset Types
// Re-export from local TypeScript types (discriminated union) instead of Rust bindings
// This ensures type compatibility across the codebase
export type { Asset } from '../../src/types/assets';
export type { AssetMetadata } from './AssetMetadata';
export type { ImageAssetMetadata } from './ImageAssetMetadata';
export type { TextAssetMetadata } from './TextAssetMetadata';

// Node Types
export type { SynniaNode } from './SynniaNode';
export type { SynniaNodeData } from './SynniaNodeData';
export type { Position } from './Position';

// Edge Types
export type { SynniaEdge } from './SynniaEdge';

// Agent Types
export type { AgentDefinition } from './AgentDefinition';
