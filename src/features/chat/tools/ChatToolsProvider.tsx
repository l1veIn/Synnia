/**
 * ChatToolsProvider
 * 
 * Registers all chat tools and their UI components within the AssistantRuntimeProvider context.
 * Tools are registered when this provider mounts and unregistered when it unmounts.
 */

import { ReactNode } from 'react';

// Tool Definitions + UIs (each file exports both)
import { GetNodesListTool, GetNodesListToolUI } from './get-nodes-list';
import { GetAssetDetailsTool, GetAssetDetailsToolUI } from './get-asset-details';
import { CreateNodeSmartTool, CreateNodeSmartToolUI } from './create-node-smart';
import { UpdateNodesTool, UpdateNodesToolUI } from './update-nodes';
import { UpdateAssetsTool, UpdateAssetsToolUI } from './update-assets';
import { DeleteNodesTool, DeleteNodesToolUI } from './delete-nodes';

interface ChatToolsProviderProps {
    children: ReactNode;
}

/**
 * Provider component that registers all chat tools for AI interaction.
 * 
 * Tools included:
 * - get_nodes_list: Get all nodes on canvas
 * - get_asset_details: Get asset information by IDs
 * - create_node_smart: Create new nodes
 * - update_nodes: Batch update node data
 * - update_assets: Batch update asset values
 * - delete_nodes: Delete nodes with confirmation (human-in-loop)
 */
export function ChatToolsProvider({ children }: ChatToolsProviderProps) {
    return (
        <>
            {/* Tool Definitions (register execute functions) */}
            <GetNodesListTool />
            <GetAssetDetailsTool />
            <CreateNodeSmartTool />
            <UpdateNodesTool />
            <UpdateAssetsTool />
            <DeleteNodesTool />

            {/* Tool UIs (register render functions) */}
            <GetNodesListToolUI />
            <GetAssetDetailsToolUI />
            <CreateNodeSmartToolUI />
            <UpdateNodesToolUI />
            <UpdateAssetsToolUI />
            <DeleteNodesToolUI />

            {children}
        </>
    );
}
