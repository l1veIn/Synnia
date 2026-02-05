import type { Asset } from '@/domain/asset/types';
import type { SynniaNode } from '@/presentation/types/project';

export function resolveNodeAssetId(node?: SynniaNode | null): string | undefined {
    if (!node) return undefined;
    const raw = (node.data as any)?.assetId;
    const trimmed = typeof raw === 'string' ? raw.trim() : '';
    if (trimmed) return trimmed;
    return node.id;
}

export function getNodeAsset(
    assets: Record<string, Asset>,
    node?: SynniaNode | null
): Asset | undefined {
    const assetId = resolveNodeAssetId(node);
    return assetId ? assets[assetId] : undefined;
}
