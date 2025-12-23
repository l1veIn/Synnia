// Port System Types
// Standardized abstractions for node data exchange

import type { SynniaNode, SynniaEdge } from '@/types/project';
import type { Asset, FieldDefinition } from '@/types/assets';

// ============================================================================
// Port Value - The standardized data packet
// ============================================================================

/**
 * Data type that can flow through ports
 */
export type PortDataType = 'text' | 'json' | 'image' | 'video' | 'array' | 'any';

/**
 * Standardized data packet exchanged between ports
 */
export interface PortValue {
    /** Data type identifier */
    type: PortDataType;

    /** The actual data */
    value: any;

    /** Optional schema for structured data (json, array) */
    schema?: FieldDefinition[];

    /** Metadata about the source */
    meta?: {
        nodeId: string;
        portId: string;
        timestamp?: number;
    };
}

// ============================================================================
// Port Definition - How a port is declared
// ============================================================================

/**
 * Port direction
 */
export type PortDirection = 'input' | 'output';

/**
 * Port definition - declares a port's contract
 */
export interface PortDefinition {
    /** Unique ID within the node (e.g., 'prompt', 'field:name', 'origin') */
    id: string;

    /** Input or output */
    direction: PortDirection;

    /** Expected data type */
    dataType: PortDataType;

    /** Human-readable label */
    label?: string;

    /** For output ports: resolver function to get the value */
    resolver?: PortResolver;

    /** For input ports: validator to check incoming data */
    validator?: PortValidator;

    /** Whether this port is semantic (origin, product) vs field-level */
    semantic?: boolean;
}

/**
 * Resolver function that extracts data from a node
 */
export type PortResolver = (
    node: SynniaNode,
    asset: Asset | null
) => PortValue | null;

/**
 * Validator function to check incoming data compatibility
 */
export type PortValidator = (incoming: PortValue) => boolean;

// ============================================================================
// Port Registration
// ============================================================================

/**
 * Configuration for registering ports on a node type
 */
export interface NodePortConfig {
    /** Static ports always present */
    static?: PortDefinition[];

    /** Dynamic port generator (e.g., from recipe schema) */
    dynamic?: (node: SynniaNode, asset: Asset | null) => PortDefinition[];
}

// ============================================================================
// Connection Types
// ============================================================================

/**
 * Result of connection validation
 */
export interface ConnectionValidation {
    valid: boolean;
    message?: string;
}

/**
 * Connection info for validation
 */
export interface ConnectionInfo {
    sourceNodeId: string;
    sourcePortId: string;
    targetNodeId: string;
    targetPortId: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if two data types are compatible for connection
 */
export function isTypeCompatible(source: PortDataType, target: PortDataType): boolean {
    // 'any' accepts everything
    if (target === 'any') return true;

    // Exact match
    if (source === target) return true;

    // 'json' can provide text (will be stringified)
    if (source === 'json' && target === 'text') return true;

    return false;
}

/**
 * Create a text PortValue
 */
export function textValue(text: string, meta?: PortValue['meta']): PortValue {
    return { type: 'text', value: text, meta };
}

/**
 * Create a JSON PortValue
 */
export function jsonValue(
    data: any,
    schema?: FieldDefinition[],
    meta?: PortValue['meta']
): PortValue {
    return { type: 'json', value: data, schema, meta };
}

/**
 * Create an image PortValue
 */
export function imageValue(url: string, meta?: PortValue['meta']): PortValue {
    return { type: 'image', value: url, meta };
}
