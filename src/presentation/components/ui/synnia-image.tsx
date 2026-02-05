import * as React from 'react';
import { cn } from '@/lib/utils';
import { SynniaSticker } from '@/presentation/components/SynniaSticker';
import { convertFileSrc } from '@tauri-apps/api/core';

/**
 * Fallback type for when image fails to load
 */
type FallbackType = 'initials' | 'sticker' | 'none';

interface SynniaImageProps {
    /** Image source: URL / local asset path (assets/xxx.jpg) / asset ID (uuid) */
    src?: string | null;
    /** Text to use for initials fallback (uses first character) */
    fallbackText?: string;
    /** Fallback type when image fails */
    fallbackType?: FallbackType;
    /** Sticker index (0-8) for sticker fallback, or 'auto' to calculate from src/fallbackText */
    stickerIndex?: number | 'auto';
    /** Alt text for accessibility */
    alt?: string;
    /** Additional CSS classes */
    className?: string;
    /** Size preset or custom pixel size */
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full' | number;
    /** Shape of the image container */
    shape?: 'circle' | 'rounded' | 'square';
    /** Object fit mode */
    fit?: 'cover' | 'contain' | 'fill';
}

const SIZE_MAP = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 56,
    xl: 80,
    full: '100%',
} as const;

// Modern pastel palette for fallbacks
const FALLBACK_PALETTE = [
    'linear-gradient(135deg, #FF9A9E 0%, #FECFEF 99%, #FECFEF 100%)', // Lady Lips
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)', // Malaga
    'linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)', // Blue Peach
    'linear-gradient(120deg, #e0c3fc 0%, #8ec5fc 100%)', // Spiky Nagy
    'linear-gradient(120deg, #f093fb 0%, #f5576c 100%)', // Perfect White
    'linear-gradient(to top, #cfd9df 0%, #e2ebf0 100%)', // Cloud
    'linear-gradient(to top, #fbc2eb 0%, #a6c1ee 100%)', // Near Moon
    'linear-gradient(120deg, #f6d365 0%, #fda085 100%)', // Sunny Morning
];

/**
 * Stable hash function for generating consistent numeric values from strings
 */
function getStableHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

/**
 * Generates a consistent gradient from a string
 */
function stringToColor(str: string): string {
    const index = getStableHash(str) % FALLBACK_PALETTE.length;
    return FALLBACK_PALETTE[index];
}

/**
 * Resolves various image source formats to a usable URL
 */
function resolveImageSrc(src: string): string {
    // Already a full URL
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
        return src;
    }

    // Local asset path (e.g., "assets/xxx.jpg")
    if (src.startsWith('assets/')) {
        // Use Tauri's convertFileSrc for local files
        // The path is relative to the project root
        return convertFileSrc(src);
    }

    // Check if it looks like a UUID (asset ID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(src)) {
        // Asset ID - would need to resolve via asset system
        // For now, treat as local asset path
        console.warn('[SynniaImage] Asset ID resolution not yet implemented:', src);
        return '';
    }

    // Assume it's a relative path
    return src;
}

/**
 * SynniaImage - Unified image component for Synnia
 * 
 * Handles multiple image sources:
 * - Remote URLs (http/https)
 * - Local asset paths (assets/xxx.jpg)
 * - Asset IDs (UUID format)
 * 
 * With fallback options:
 * - Initials (first letter of fallbackText)
 * - SynniaSticker (cute mascot)
 * - None (transparent)
 */
export const SynniaImage = React.forwardRef<HTMLDivElement, SynniaImageProps>(
    (
        {
            src,
            fallbackText,
            fallbackType = 'initials',
            stickerIndex = 'auto',
            alt = '',
            className,
            size = 'md',
            shape = 'circle',
            fit = 'cover',
        },
        ref
    ) => {
        const [hasError, setHasError] = React.useState(false);
        const [isLoading, setIsLoading] = React.useState(true);

        // Reset error state when src changes
        React.useEffect(() => {
            setHasError(false);
            setIsLoading(true);
        }, [src]);

        // Calculate size
        const sizeValue = typeof size === 'number' ? size : SIZE_MAP[size];

        // Resolve image source
        const resolvedSrc = src ? resolveImageSrc(src) : '';
        const showImage = resolvedSrc && !hasError;

        // Get initials
        const initials = fallbackText ? fallbackText.charAt(0).toUpperCase() : '?';
        const bgColor = fallbackText ? stringToColor(fallbackText) : 'hsl(var(--muted))';

        // Auto-calculate sticker index if needed
        const computedStickerIndex =
            stickerIndex === 'auto'
                ? getStableHash(src || fallbackText || 'default') % 9
                : stickerIndex;

        // Shape classes
        const shapeClasses = {
            circle: 'rounded-full',
            rounded: 'rounded-lg',
            square: 'rounded-none',
        };

        // Container styles
        const containerStyle: React.CSSProperties = {
            width: sizeValue,
            height: sizeValue,
            fontSize: typeof sizeValue === 'number' ? sizeValue * 0.4 : '1rem',
        };

        return (
            <div
                ref={ref}
                className={cn(
                    'relative flex items-center justify-center overflow-hidden shrink-0',
                    'bg-muted text-muted-foreground font-medium',
                    shapeClasses[shape],
                    className
                )}
                style={containerStyle}
            >
                {/* Actual image */}
                {showImage && (
                    <img
                        src={resolvedSrc}
                        alt={alt}
                        className={cn(
                            'absolute inset-0 w-full h-full transition-opacity duration-200',
                            isLoading ? 'opacity-0' : 'opacity-100'
                        )}
                        style={{ objectFit: fit }}
                        onLoad={() => setIsLoading(false)}
                        onError={() => {
                            setHasError(true);
                            setIsLoading(false);
                        }}
                    />
                )}

                {/* Fallback (shown when no image or error) */}
                {(!showImage || isLoading) && (
                    <div
                        className="absolute inset-0 flex items-center justify-center bg-cover bg-center"
                        style={fallbackType === 'initials' ? { background: bgColor } : undefined}
                    >
                        {fallbackType === 'sticker' && (
                            <SynniaSticker index={computedStickerIndex} className="w-full h-full" />
                        )}
                        {fallbackType === 'initials' && (
                            <span className="text-white font-bold select-none drop-shadow-md">
                                {initials}
                            </span>
                        )}
                    </div>
                )}
            </div>
        );
    }
);

SynniaImage.displayName = 'SynniaImage';

export type { SynniaImageProps, FallbackType };
