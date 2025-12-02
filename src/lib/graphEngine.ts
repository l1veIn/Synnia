import { AssetData, NodeStatus } from "@/types/project";
import { Node, Edge } from "@xyflow/react";

/**
 * Synnia Graph Engine
 * Implements core DAG algorithms and Consistency Logic.
 * Pure functions only.
 */

// --- 1. Hash Computation (Content Fingerprint) ---
const deterministicStringify = (obj: any): string => {
    if (obj === null || typeof obj !== 'object') {
        return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
        return '[' + obj.map(deterministicStringify).join(',') + ']';
    }
    // Sort keys for stability
    const keys = Object.keys(obj).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + deterministicStringify(obj[k])).join(',') + '}';
};

export const computeNodeHash = (data: AssetData): string => {
    // Only hash properties that define the content.
    // Status, validationErrors, and previous provenance are excluded.
    
    // Exclude 'name' from properties as it's metadata, not content
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { name, ...contentProps } = data.properties;

    const contentObj = {
        properties: contentProps,
        assetType: data.assetType
    };
    
    const fingerprint = deterministicStringify(contentObj);
    
    // Simple DJB2 hash
    let hash = 5381;
    for (let i = 0; i < fingerprint.length; i++) {
        hash = ((hash << 5) + hash) + fingerprint.charCodeAt(i);
        hash = hash | 0; // Force 32-bit integer
    }
    return (hash >>> 0).toString(16); // Ensure unsigned 32-bit
};

// --- 2. Cycle Detection (DAG Constraint) ---
export const hasCycle = (_nodes: Node[], edges: Edge[], newEdge: Edge): boolean => {
    if (newEdge.source === newEdge.target) return false; // Self-loops handled separately as in-place updates

    const target = newEdge.target;
    const source = newEdge.source;

    // DFS to check if 'source' is reachable from 'target'
    // If yes, adding source->target would create a cycle
    const visited = new Set<string>();
    const stack = [target];

    while (stack.length > 0) {
        const current = stack.pop()!;
        if (current === source) return true; // Cycle found!

        if (!visited.has(current)) {
            visited.add(current);
            // Find all nodes that 'current' points to
            const outGoing = edges
                .filter(e => e.source === current)
                .map(e => e.target);
            stack.push(...outGoing);
        }
    }

    return false;
};

// --- 3. Consistency Evaluation (The Heart) ---
export const evaluateNodeStatus = (
    node: Node<AssetData>, 
    allNodes: Node<AssetData>[]
): NodeStatus => {
    // 1. If processing, stay processing
    if (node.data.status === 'processing') return 'processing';

    // 2. Check Provenance
    const provenance = node.data.provenance;
    if (!provenance) return 'idle'; // Raw material

    // 3. Validate Upstream
    for (const source of provenance.sources) {
        const upstreamNode = allNodes.find(n => n.id === source.nodeId);
        
        // Case A: Upstream Missing -> Broken Link (Error)
        if (!upstreamNode) return 'error';

        // Case B: Upstream Hash Mismatch -> Stale
        // Note: We compare current upstream hash with the recorded 'nodeHash' in provenance
        if (source.nodeHash && upstreamNode.data.hash) {
            if (source.nodeHash !== upstreamNode.data.hash) {
                return 'stale';
            }
        } else {
            // If no hash recorded (legacy), rely on version? 
            // Or just assume stale if we want strictness.
            // Let's assume idle if no hash info to avoid noise during migration.
        }
        
        // Case C: Upstream itself is Stale/Error?
        // Strict consistency: if parent is stale, child is stale?
        // Lazy consistency: No, child only stale if parent *output* changes.
        // We stick to Lazy.
    }

    // 4. If all checks pass
    return 'success';
};

// --- 4. Dependency Analysis ---
export const getDownstreamNodes = (
    sourceId: string, 
    nodes: Node<AssetData>[], 
    edges: Edge[]
): Node<AssetData>[] => {
    // Find direct children
    const childIds = edges
        .filter(e => e.source === sourceId)
        .map(e => e.target);
    
    return nodes.filter(n => childIds.includes(n.id));
};
