// Canvas Utils Tests
// Tests for image cropping, rotation, and canvas manipulation utilities

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    getRadianAngle,
    rotateSize,
    generateIcoBlob,
} from '../canvas';

// ============================================================================
// Mocks - Setup before importing canvas utilities
// ============================================================================

// Mock createImageBitmap
const mockCreateImageBitmap = vi.fn(async (_blob: Blob) => {
    return {
        width: 32,
        height: 32,
        close: vi.fn(),
    } as ImageBitmap;
});

global.createImageBitmap = mockCreateImageBitmap;

// Mock HTMLCanvasElement and related APIs
class MockCanvasRenderingContext2D {
    canvas: unknown;
    private _savedStates: Array<unknown> = [];

    constructor(canvas: unknown) {
        this.canvas = canvas;
    }

    scale() {}
    translate() {}
    rotate() {}
    save() {
        this._savedStates.push({});
    }
    restore() {
        this._savedStates.pop();
    }
    drawImage() {}
}

class MockHTMLCanvasElement {
    width = 0;
    height = 0;
    private _context: MockCanvasRenderingContext2D | null = null;

    getContext(contextType: string): MockCanvasRenderingContext2D | null {
        if (contextType === '2d') {
            if (!this._context) {
                this._context = new MockCanvasRenderingContext2D(this);
            }
            return this._context;
        }
        return null;
    }

    toDataURL() {
        return 'data:image/png;base64,mockData';
    }

    toBlob(callback: (blob: Blob | null) => void) {
        const mockBlob = new Blob(['mock data'], { type: 'image/png' });
        callback(mockBlob);
    }
}

// Set up document mock
const originalDocument = global.document;
global.document = {
    ...originalDocument,
    createElement: function (tag: string) {
        if (tag === 'canvas') {
            return new MockHTMLCanvasElement();
        }
        return originalDocument?.createElement?.(tag) ?? {};
    },
} as Document & { createElement: (tag: string) => unknown };

// Set up window mock
global.window = {
    devicePixelRatio: 1,
} as Window & { devicePixelRatio: number };

// Set up HTMLCanvasElement
global.HTMLCanvasElement = MockHTMLCanvasElement as typeof global.HTMLCanvasElement;

// Mock Image class that auto-resolves
class MockImage {
    src = '';
    width = 100;
    height = 100;
    naturalWidth = 200;
    naturalHeight = 200;

    addEventListener(type: string, listener: (event: Event) => void) {
        // Auto-trigger load event on next tick
        if (type === 'load') {
            Promise.resolve().then(() => {
                listener(new Event('load'));
            });
        }
    }

    removeEventListener() {}

    setAttribute(name: string, value: string) {
        if (name === 'src') {
            this.src = value;
        }
    }
}

global.Image = MockImage as typeof global.Image;

// ============================================================================
// Tests
// ============================================================================

describe('getRadianAngle', () => {
    it('should convert 0 degrees to 0 radians', () => {
        expect(getRadianAngle(0)).toBe(0);
    });

    it('should convert 90 degrees to PI/2 radians', () => {
        expect(getRadianAngle(90)).toBeCloseTo(Math.PI / 2);
    });

    it('should convert 180 degrees to PI radians', () => {
        expect(getRadianAngle(180)).toBeCloseTo(Math.PI);
    });

    it('should convert 360 degrees to 2*PI radians', () => {
        expect(getRadianAngle(360)).toBeCloseTo(2 * Math.PI);
    });

    it('should handle negative angles', () => {
        expect(getRadianAngle(-90)).toBeCloseTo(-Math.PI / 2);
    });

    it('should handle fractional degrees', () => {
        expect(getRadianAngle(45)).toBeCloseTo(Math.PI / 4);
        expect(getRadianAngle(22.5)).toBeCloseTo(Math.PI / 8);
    });
});

// ============================================================================
// rotateSize Tests
// ============================================================================

describe('rotateSize', () => {
    it('should return same size for 0 degree rotation', () => {
        const result = rotateSize(100, 50, 0);
        expect(result.width).toBeCloseTo(100);
        expect(result.height).toBeCloseTo(50);
    });

    it('should calculate bounding box for 90 degree rotation', () => {
        const result = rotateSize(100, 50, 90);
        expect(result.width).toBeCloseTo(50);
        expect(result.height).toBeCloseTo(100);
    });

    it('should calculate bounding box for 180 degree rotation', () => {
        const result = rotateSize(100, 50, 180);
        expect(result.width).toBeCloseTo(100);
        expect(result.height).toBeCloseTo(50);
    });

    it('should calculate bounding box for 270 degree rotation', () => {
        const result = rotateSize(100, 50, 270);
        expect(result.width).toBeCloseTo(50);
        expect(result.height).toBeCloseTo(100);
    });

    it('should calculate bounding box for 45 degree rotation', () => {
        const result = rotateSize(100, 100, 45);
        const expectedSize = 100 * Math.abs(Math.cos(Math.PI / 4)) + 100 * Math.abs(Math.sin(Math.PI / 4));
        expect(result.width).toBeCloseTo(expectedSize);
        expect(result.height).toBeCloseTo(expectedSize);
    });

    it('should handle negative rotations', () => {
        const result1 = rotateSize(100, 50, -90);
        const result2 = rotateSize(100, 50, 90);
        expect(result1.width).toBeCloseTo(result2.width);
        expect(result1.height).toBeCloseTo(result2.height);
    });

    it('should handle non-square images with rotation', () => {
        const result = rotateSize(200, 100, 30);
        expect(result.width).toBeGreaterThan(0);
        expect(result.height).toBeGreaterThan(0);
        expect(result.width).toBeGreaterThan(100);
        expect(result.height).toBeGreaterThan(100);
    });
});

// ============================================================================
// generateIcoBlob Tests
// ============================================================================

describe('generateIcoBlob', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should generate an ICO blob from PNG blob', async () => {
        const pngBlob = new Blob(['PNG data'], { type: 'image/png' });

        const result = await generateIcoBlob(pngBlob);

        expect(result).toBeInstanceOf(Blob);
        expect(result.type).toBe('image/x-icon');
    });

    it('should create ICO with correct header structure', async () => {
        const pngBlob = new Blob(['PNG data'], { type: 'image/png' });

        const result = await generateIcoBlob(pngBlob);
        const arrayBuffer = await result.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // ICO header: Reserved (2 bytes) should be 0
        expect(uint8Array[0]).toBe(0);
        expect(uint8Array[1]).toBe(0);

        // Type (2 bytes) should be 1 for ICO
        expect(uint8Array[2]).toBe(1);
        expect(uint8Array[3]).toBe(0);

        // Count (2 bytes) should be 1 for single image
        expect(uint8Array[4]).toBe(1);
        expect(uint8Array[5]).toBe(0);
    });

    it('should set width and height correctly for small images', async () => {
        mockCreateImageBitmap.mockResolvedValueOnce({
            width: 32,
            height: 32,
            close: vi.fn(),
        });

        const pngBlob = new Blob(['PNG data'], { type: 'image/png' });

        const result = await generateIcoBlob(pngBlob);
        const arrayBuffer = await result.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Width at offset 6
        expect(uint8Array[6]).toBe(32);
        // Height at offset 7
        expect(uint8Array[7]).toBe(32);
    });

    it('should set width and height to 0 for large images (>255)', async () => {
        mockCreateImageBitmap.mockResolvedValueOnce({
            width: 300,
            height: 400,
            close: vi.fn(),
        });

        const pngBlob = new Blob(['PNG data'], { type: 'image/png' });

        const result = await generateIcoBlob(pngBlob);
        const arrayBuffer = await result.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Width and height should be 0 for dimensions > 255
        expect(uint8Array[6]).toBe(0);
        expect(uint8Array[7]).toBe(0);
    });

    it('should include PNG data after ICO header', async () => {
        const pngData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
        const pngBlob = new Blob([pngData], { type: 'image/png' });

        const result = await generateIcoBlob(pngBlob);
        const arrayBuffer = await result.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // ICO header is 22 bytes, PNG data should follow
        expect(uint8Array[22]).toBe(0x89);
        expect(uint8Array[23]).toBe(0x50);
        expect(uint8Array[24]).toBe(0x4e);
        expect(uint8Array[25]).toBe(0x47);
    });

    it('should set correct planes value', async () => {
        const pngBlob = new Blob(['PNG data'], { type: 'image/png' });

        const result = await generateIcoBlob(pngBlob);
        const arrayBuffer = await result.arrayBuffer();
        const dataView = new DataView(arrayBuffer);

        // Planes at offset 10 should be 1
        expect(dataView.getUint16(10, true)).toBe(1);
    });

    it('should set correct bit count (32 for RGBA)', async () => {
        const pngBlob = new Blob(['PNG data'], { type: 'image/png' });

        const result = await generateIcoBlob(pngBlob);
        const arrayBuffer = await result.arrayBuffer();
        const dataView = new DataView(arrayBuffer);

        // BitCount at offset 12 should be 32
        expect(dataView.getUint16(12, true)).toBe(32);
    });

    it('should set correct size in bytes', async () => {
        const pngData = new Uint8Array([1, 2, 3, 4, 5]);
        const pngBlob = new Blob([pngData], { type: 'image/png' });

        const result = await generateIcoBlob(pngBlob);
        const arrayBuffer = await result.arrayBuffer();
        const dataView = new DataView(arrayBuffer);

        // SizeInBytes at offset 14 should match PNG data length
        expect(dataView.getUint32(14, true)).toBe(5);
    });

    it('should set correct image offset (22, after header)', async () => {
        const pngBlob = new Blob(['PNG data'], { type: 'image/png' });

        const result = await generateIcoBlob(pngBlob);
        const arrayBuffer = await result.arrayBuffer();
        const dataView = new DataView(arrayBuffer);

        // ImageOffset at offset 18 should be 22
        expect(dataView.getUint32(18, true)).toBe(22);
    });

    it('should handle empty PNG blob', async () => {
        const pngBlob = new Blob([], { type: 'image/png' });

        const result = await generateIcoBlob(pngBlob);

        expect(result.type).toBe('image/x-icon');
        const arrayBuffer = await result.arrayBuffer();
        expect(arrayBuffer.byteLength).toBeGreaterThan(0); // At least header
    });

    it('should handle ImageBitmap creation failure', async () => {
        mockCreateImageBitmap.mockRejectedValueOnce(new Error('Failed to create ImageBitmap'));

        const pngBlob = new Blob(['PNG data'], { type: 'image/png' });

        await expect(generateIcoBlob(pngBlob)).rejects.toThrow('Failed to create ImageBitmap');
    });
});

// ============================================================================
// getRotatedImage Tests (using vi.mock)
// ============================================================================

describe('getRotatedImage', () => {
    // Dynamic import to get fresh module with mocked Image
    async function importGetRotatedImage() {
        return (await import('../canvas')).getRotatedImage;
    }

    it('should return data URL for image with 0 rotation', async () => {
        const getRotatedImage = await importGetRotatedImage();
        const imageSrc = 'data:image/png;base64,abc123';

        const result = await getRotatedImage(imageSrc, 0);

        expect(result).toContain('data:image');
    });

    it('should rotate image by 90 degrees', async () => {
        const getRotatedImage = await importGetRotatedImage();
        const imageSrc = 'data:image/png;base64,abc123';

        const result = await getRotatedImage(imageSrc, 90);

        expect(result).toContain('data:image');
    });

    it('should rotate image by 180 degrees', async () => {
        const getRotatedImage = await importGetRotatedImage();
        const imageSrc = 'data:image/png;base64,abc123';

        const result = await getRotatedImage(imageSrc, 180);

        expect(result).toContain('data:image');
    });

    it('should rotate image by 270 degrees', async () => {
        const getRotatedImage = await importGetRotatedImage();
        const imageSrc = 'data:image/png;base64,abc123';

        const result = await getRotatedImage(imageSrc, 270);

        expect(result).toContain('data:image');
    });

    it('should handle negative rotation', async () => {
        const getRotatedImage = await importGetRotatedImage();
        const imageSrc = 'data:image/png;base64,abc123';

        const result = await getRotatedImage(imageSrc, -45);

        expect(result).toContain('data:image');
    });

    it('should default rotation to 0 when not provided', async () => {
        const getRotatedImage = await importGetRotatedImage();
        const imageSrc = 'data:image/png;base64,abc123';

        const result = await getRotatedImage(imageSrc);

        expect(result).toContain('data:image');
    });

    it('should return original image source when canvas context is null', async () => {
        const getRotatedImage = await importGetRotatedImage();
        const imageSrc = 'data:image/png;base64,original';

        // Override createElement to return canvas with null context
        const NullContextCanvas = class extends MockHTMLCanvasElement {
            getContext() {
                return null;
            }
        };

        const originalCreateElement = global.document.createElement;
        global.document.createElement = function (tag: string) {
            if (tag === 'canvas') {
                return new NullContextCanvas();
            }
            return originalCreateElement.call(document, tag);
        };

        const result = await getRotatedImage(imageSrc, 90);

        // Should return original source when context is null
        expect(result).toBe(imageSrc);

        // Restore
        global.document.createElement = originalCreateElement;
    });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('canvas utils integration', () => {
    it('should complete rotation workflow', async () => {
        const { getRotatedImage } = await import('../canvas');
        const imageSrc = 'data:image/png;base64,abc123';

        const result = await getRotatedImage(imageSrc, 45);

        expect(result).toContain('data:image');
    });

    it('should convert PNG to ICO for favicon use', async () => {
        const pngBlob = new Blob(['PNG icon data'], { type: 'image/png' });

        const icoBlob = await generateIcoBlob(pngBlob);

        expect(icoBlob.type).toBe('image/x-icon');
        expect(icoBlob).toBeInstanceOf(Blob);
    });

    it('should handle full rotation (360 degrees)', async () => {
        const { getRotatedImage } = await import('../canvas');
        const imageSrc = 'data:image/png;base64,abc123';

        const result = await getRotatedImage(imageSrc, 360);

        expect(result).toContain('data:image');
    });
});
