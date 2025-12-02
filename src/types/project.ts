// Re-export generated bindings to maintain cleaner imports in the app
// This file acts as a barrel file for all project-related types.

// Import generated types
import {
    SynniaProject as GenProject,
    SynniaNode as GenNode,
    SynniaEdge as GenEdge,
    AssetData as GenAssetData,
    NodeStatus as GenNodeStatus,
    AgentDefinition as GenAgentDefinition,
    Provenance as GenProvenance,
    ProvenanceSource as GenProvenanceSource,
    ProjectMeta as GenProjectMeta
} from '../bindings/synnia';

// Re-export with explicit names if needed, or directly
export type SynniaProject = GenProject;
export type SynniaNode = GenNode;
export type SynniaEdge = GenEdge;
export type AssetData = GenAssetData;
export type NodeStatus = GenNodeStatus;
export type AgentDefinition = GenAgentDefinition;
export type Provenance = GenProvenance;
export type ProvenanceSource = GenProvenanceSource;
export type ProjectMeta = GenProjectMeta;

// Manual Helper Types
export type AssetType = string; // Keep flexible string

// Helper for Properties
export interface AssetProperties {
    name: string;
    description?: string;
    tags?: string[];
    src?: string;
    content?: string;
    [key: string]: any;
}