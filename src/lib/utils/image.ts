// Image Utility Functions
// Normalize image data for different model APIs

export interface ImageData {
    type: 'url' | 'base64' | 'asset';
    url?: string;
    base64?: string;
    assetId?: string;
    mimeType?: string;
}

export interface ImagePickerValue {
    source: 'url' | 'base64' | 'asset' | 'connected';
    url?: string;
    base64?: string;
    assetId?: string;
    mimeType?: string;
    fileName?: string;
}

/**
 * Convert file to base64 data URL
 */
export async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Fetch URL and convert to base64
 */
export async function urlToBase64(url: string): Promise<string> {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Extract base64 data from data URL
 */
export function dataUrlToBase64(dataUrl: string): { base64: string; mimeType: string } {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
        throw new Error('Invalid data URL');
    }
    return {
        mimeType: match[1],
        base64: match[2],
    };
}

/**
 * Normalize ImagePickerValue to what a model needs
 */
export async function normalizeImage(
    value: ImagePickerValue | undefined,
    format: 'url' | 'base64' | 'dataUrl' = 'url'
): Promise<string | null> {
    if (!value) return null;

    switch (value.source) {
        case 'url':
            if (format === 'url') return value.url || null;
            if (format === 'base64' || format === 'dataUrl') {
                if (!value.url) return null;
                const dataUrl = await urlToBase64(value.url);
                return format === 'base64' ? dataUrlToBase64(dataUrl).base64 : dataUrl;
            }
            break;

        case 'base64':
            if (format === 'base64') return value.base64 || null;
            if (format === 'dataUrl') {
                const mime = value.mimeType || 'image/png';
                return `data:${mime};base64,${value.base64}`;
            }
            if (format === 'url') {
                // Cannot easily convert base64 to URL without server
                // Return as data URL which some APIs accept
                const mime = value.mimeType || 'image/png';
                return `data:${mime};base64,${value.base64}`;
            }
            break;

        case 'asset':
            // Need to load from asset system
            // TODO: Implement asset loading
            console.warn('[Image] Asset loading not implemented yet');
            return null;

        case 'connected':
            // Value comes from connected node, should already be URL or base64
            if (value.url) {
                if (format === 'url') return value.url;
                const dataUrl = await urlToBase64(value.url);
                return format === 'base64' ? dataUrlToBase64(dataUrl).base64 : dataUrl;
            }
            if (value.base64) {
                if (format === 'base64') return value.base64;
                const mime = value.mimeType || 'image/png';
                return `data:${mime};base64,${value.base64}`;
            }
            break;
    }

    return null;
}

/**
 * Check if a string is a valid URL
 */
export function isValidUrl(str: string): boolean {
    try {
        new URL(str);
        return true;
    } catch {
        return false;
    }
}

/**
 * Check if a string is a data URL
 */
export function isDataUrl(str: string): boolean {
    return str.startsWith('data:');
}

/**
 * Get file extension from MIME type
 */
export function mimeToExtension(mimeType: string): string {
    const map: Record<string, string> = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/gif': 'gif',
        'image/webp': 'webp',
    };
    return map[mimeType] || 'png';
}
