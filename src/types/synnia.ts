// Manually defined types mirroring Rust structs
// In future, generate these using `cargo test` + ts-rs

export type AssetType = "Image" | "Text" | "Prompt" | "Link" | "Grid" | "Other";
export type NodeStatus = "Active" | "Outdated" | "Archived" | "Processing" | "Error";

export interface Project {
    id: string;
    name: string;
    created_at: string;
    path: string;
}

export interface AssetNode {
    id: string;
    project_id: string;
    type_: AssetType;
    status: NodeStatus;
    current_version_id: string | null;
    x: number;
    y: number;
    created_at: string;
    updated_at: string;
}

export interface AssetVersion {
    id: string;
    asset_id: string;
    payload: string;
    meta: string | null;
    created_at: string;
}

export interface Edge {
    id: string;
    source_id: string;
    target_id: string;
    recipe: string | null;
    created_at: string;
}