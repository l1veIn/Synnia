export type NodeLayoutMode = 'free' | 'rack' | 'list' | 'grid';

export type NodePresentation = {
    position: { x: number; y: number };
    size?: { width?: number; height?: number };
    style?: Record<string, string | number>;
    layout?: {
        mode?: NodeLayoutMode;
        dockedTo?: string | null;
        parentId?: string | null;
    };
    expanded?: {
        collapsed: boolean;
        expandedWidth?: number;
        expandedHeight?: number;
        originalPosition?: { x: number; y: number };
    };
    visibility?: { hidden?: boolean };
    ui?: { hasProductHandle?: boolean };
};
