import { AssetData as BaseAssetData } from '../../src-tauri/bindings/AssetData';
import { NodeStatus } from '../../src-tauri/bindings/NodeStatus';
import { Provenance } from '../../src-tauri/bindings/Provenance';

// --- Specialized Property Interfaces ---

export interface ImageAssetProperties {
    name: string;
    content: string; // Path or URL
    width?: number;
    height?: number;
    format?: string;
}

export interface TextAssetProperties {
    name: string;
    content: string;
    language?: string; // e.g. "markdown", "python"
}

export interface PromptAssetProperties {
    name: string;
    content: string; // The prompt template
    variables?: string[];
    model?: string;
}

export interface CollectionAssetProperties {
    name: string;
    description?: string;
    collapsed?: boolean;
}

export interface ReferenceAssetProperties {
    targetId: string;
    originalPath?: string;
}

// --- Discriminated Union Types ---

export interface ImageAsset extends Omit<BaseAssetData, 'properties' | 'assetType'> {
    assetType: 'image_asset' | 'Image';
    properties: ImageAssetProperties;
}

export interface TextAsset extends Omit<BaseAssetData, 'properties' | 'assetType'> {
    assetType: 'text_asset' | 'Text';
    properties: TextAssetProperties;
}

export interface PromptAsset extends Omit<BaseAssetData, 'properties' | 'assetType'> {
    assetType: 'prompt_asset' | 'Prompt';
    properties: PromptAssetProperties;
}

export interface CollectionAsset extends Omit<BaseAssetData, 'properties' | 'assetType'> {
    assetType: 'collection_asset';
    properties: CollectionAssetProperties;
}

export interface ReferenceAsset extends Omit<BaseAssetData, 'properties' | 'assetType'> {
    assetType: 'reference_asset';
    properties: ReferenceAssetProperties;
}

// Fallback for unknown types
export interface GenericAsset extends BaseAssetData {
    assetType: string;
}

// The Master Union Type
export type SynniaAsset = 
    | ImageAsset 
    | TextAsset 
    | PromptAsset 
    | CollectionAsset 
    | ReferenceAsset
    | GenericAsset;

// --- Type Guards ---

export function isImageAsset(asset: SynniaAsset): asset is ImageAsset {
    return asset.assetType === 'image_asset' || asset.assetType === 'Image';
}

export function isTextAsset(asset: SynniaAsset): asset is TextAsset {
    return asset.assetType === 'text_asset' || asset.assetType === 'Text';
}

export function isCollectionAsset(asset: SynniaAsset): asset is CollectionAsset {
    return asset.assetType === 'collection_asset';
}

export function isReferenceAsset(asset: SynniaAsset): asset is ReferenceAsset {
    return asset.assetType === 'reference_asset';
}
