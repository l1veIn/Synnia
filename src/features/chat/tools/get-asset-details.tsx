/**
 * get_asset_details Tool
 * 
 * Returns detailed information about one or more assets by their IDs.
 */

import { makeAssistantTool, makeAssistantToolUI } from "@assistant-ui/react";
import { z } from "zod";
import { graphEngine } from "@core/engine/GraphEngine";
import { FileText, AlertCircle } from "lucide-react";

// =============================================================================
// Tool Definition
// =============================================================================

interface AssetDetail {
    id: string;
    valueType?: string;
    name?: string;
    source?: string;
    createdAt?: number;
    updatedAt?: number;
    valuePreview?: string;
    error?: string;
}

export const GetAssetDetailsTool = makeAssistantTool({
    toolName: "get_asset_details",
    description: "Get detailed information about one or more assets by their IDs. Returns id, valueType, name, source, timestamps, and a preview of the value.",
    parameters: z.object({
        assetIds: z.array(z.string()).describe("Array of asset IDs to retrieve"),
    }),
    execute: async ({ assetIds }): Promise<AssetDetail[]> => {
        const assets = graphEngine.state.assets;

        return assetIds.map(id => {
            const asset = assets[id];
            if (!asset) {
                return { id, error: "Asset not found" };
            }

            // Safely create value preview
            let valuePreview: string | undefined;
            try {
                const val = asset.value as unknown;
                if (typeof val === 'string') {
                    valuePreview = val.slice(0, 200);
                } else if (val !== undefined && val !== null) {
                    valuePreview = JSON.stringify(val).slice(0, 200);
                }
            } catch {
                valuePreview = "[Unable to preview]";
            }

            return {
                id: asset.id,
                valueType: asset.valueType,
                name: asset.sys?.name || "Untitled",
                source: asset.sys?.source,
                createdAt: asset.sys?.createdAt,
                updatedAt: asset.sys?.updatedAt,
                valuePreview,
            };
        });
    },
});

// =============================================================================
// Tool UI
// =============================================================================

export const GetAssetDetailsToolUI = makeAssistantToolUI({
    toolName: "get_asset_details",
    render: ({ result, status }) => {
        if (status.type === "running") {
            return (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground animate-pulse">
                    <FileText className="size-4" />
                    <span>Getting asset details...</span>
                </div>
            );
        }

        const assets = result as AssetDetail[] | undefined;

        if (!assets || assets.length === 0) {
            return (
                <div className="p-3 text-muted-foreground text-sm border rounded-lg my-2">
                    No assets found
                </div>
            );
        }

        return (
            <div className="border rounded-lg overflow-hidden my-2">
                <div className="bg-muted px-3 py-2 text-sm font-medium border-b flex items-center gap-2">
                    <FileText className="size-4" />
                    <span>Assets ({assets.length})</span>
                </div>
                <div className="divide-y max-h-80 overflow-y-auto">
                    {assets.map(asset => (
                        <div key={asset.id} className="px-3 py-2 text-sm">
                            {asset.error ? (
                                <div className="flex items-center gap-2 text-destructive">
                                    <AlertCircle className="size-4" />
                                    <span className="font-mono text-xs">{asset.id.slice(0, 8)}</span>
                                    <span>{asset.error}</span>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs text-muted-foreground">
                                            {asset.id.slice(0, 8)}
                                        </span>
                                        <span className="font-medium">{asset.name}</span>
                                        <span className="text-xs px-1.5 py-0.5 bg-muted rounded">
                                            {asset.valueType}
                                        </span>
                                    </div>
                                    {asset.valuePreview && (
                                        <div className="text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded truncate">
                                            {asset.valuePreview}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    },
});
