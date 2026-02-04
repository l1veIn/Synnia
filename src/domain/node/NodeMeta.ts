export interface NodeSysMetadata {
    name: string;
    createdAt: number;
    updatedAt: number;
    source: string;
    isLibraryAsset: boolean | null;
}

export interface NodeValueMeta {
    preview?: string;
    length?: number;
    width?: number;
    height?: number;
}

export interface NodeMeta {
    sys: NodeSysMetadata;
    valueMeta?: NodeValueMeta;
    ui?: { icon?: string; label?: string };
    ext?: Record<string, unknown>;
}
