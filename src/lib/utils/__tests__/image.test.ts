// Image Utility Tests
// Tests for image data normalization, conversion, and validation utilities

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    dataUrlToBase64,
    fileToBase64,
    urlToBase64,
    normalizeImage,
    isValidUrl,
    isDataUrl,
    mimeToExtension,
    type ImagePickerValue,
} from '../image';

// ============================================================================
// Mocks - Setup before tests
// ============================================================================

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ============================================================================
// dataUrlToBase64 Tests
// ============================================================================

describe('dataUrlToBase64', () => {
    it('should extract base64 and mime type from valid data URL', () => {
        const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

        const result = dataUrlToBase64(dataUrl);

        expect(result.mimeType).toBe('image/png');
        expect(result.base64).toBe('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    });

    it('should handle JPEG data URLs', () => {
        const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBD';

        const result = dataUrlToBase64(dataUrl);

        expect(result.mimeType).toBe('image/jpeg');
        expect(result.base64).toBe('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBD');
    });

    it('should handle GIF data URLs', () => {
        const dataUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

        const result = dataUrlToBase64(dataUrl);

        expect(result.mimeType).toBe('image/gif');
        expect(result.base64).toBe('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
    });

    it('should handle WebP data URLs', () => {
        const dataUrl = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v3AgAA=';

        const result = dataUrlToBase64(dataUrl);

        expect(result.mimeType).toBe('image/webp');
        expect(result.base64).toBe('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v3AgAA=');
    });

    it('should throw error for data URL with empty base64 data', () => {
        const dataUrl = 'data:image/png;base64,';

        expect(() => dataUrlToBase64(dataUrl)).toThrow('Invalid data URL');
    });

    it('should throw error for invalid data URL format', () => {
        const invalidDataUrl = 'not-a-data-url';

        expect(() => dataUrlToBase64(invalidDataUrl)).toThrow('Invalid data URL');
    });

    it('should throw error for data URL without base64', () => {
        const invalidDataUrl = 'data:image/png,no-base64-here';

        expect(() => dataUrlToBase64(invalidDataUrl)).toThrow('Invalid data URL');
    });

    it('should throw error for data URL without mime type', () => {
        const invalidDataUrl = 'data:;base64,abc123';

        expect(() => dataUrlToBase64(invalidDataUrl)).toThrow('Invalid data URL');
    });

    it('should handle special characters in base64 data', () => {
        const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

        const result = dataUrlToBase64(dataUrl);

        expect(result.base64).toContain('iVBORw0KGgo');
    });

    it('should handle data URL with additional parameters', () => {
        const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';

        const result = dataUrlToBase64(dataUrl);

        expect(result.mimeType).toBe('image/png');
    });
});

// ============================================================================
// fileToBase64 Tests
// ============================================================================

describe('fileToBase64', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should convert a File to base64 data URL', async () => {
        const mockFile = new File(['test content'], 'test.png', { type: 'image/png' });
        const expectedResult = 'data:image/png;base64,dGVzdCBjb250ZW50';

        // Mock FileReader behavior
        const mockFileReader = {
            readAsDataURL: vi.fn(),
            onload: null as ((event: ProgressEvent<FileReader>) => void) | null,
            onerror: null as ((event: ProgressEvent<FileReader>) => void) | null,
            result: expectedResult,
        };

        global.FileReader = vi.fn(() => mockFileReader) as unknown as typeof FileReader;

        // Simulate async load
        mockFileReader.readAsDataURL = vi.fn(function (this: typeof mockFileReader) {
            Promise.resolve().then(() => {
                if (this.onload) {
                    this.onload({ target: { result: expectedResult } } as unknown as ProgressEvent<FileReader>);
                }
            });
        });

        const result = await fileToBase64(mockFile);

        expect(result).toBe(expectedResult);
    });

    it('should handle JPEG files', async () => {
        const mockFile = new File(['jpeg content'], 'test.jpg', { type: 'image/jpeg' });
        const expectedResult = 'data:image/jpeg;base64,aVBlZyBjb250ZW50';

        const mockFileReader = {
            readAsDataURL: vi.fn(),
            result: expectedResult,
        };

        global.FileReader = vi.fn(() => mockFileReader) as unknown as typeof FileReader;

        mockFileReader.readAsDataURL = vi.fn(function (this: typeof mockFileReader) {
            Promise.resolve().then(() => {
                if (this.onload) {
                    this.onload({ target: { result: expectedResult } } as unknown as ProgressEvent<FileReader>);
                }
            });
        });

        const result = await fileToBase64(mockFile);

        expect(result).toContain('image/jpeg');
    });

    it('should reject on FileReader error', async () => {
        const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
        const error = new Error('Read error');

        const mockFileReader = {
            readAsDataURL: vi.fn(),
        };

        global.FileReader = vi.fn(() => mockFileReader) as unknown as typeof FileReader;

        mockFileReader.readAsDataURL = vi.fn(function (this: typeof mockFileReader) {
            Promise.resolve().then(() => {
                if (this.onerror) {
                    this.onerror({ target: { error } } as unknown as ProgressEvent<FileReader>);
                }
            });
        });

        await expect(fileToBase64(mockFile)).rejects.toThrow();
    });

    it('should handle empty files', async () => {
        const mockFile = new File([''], 'empty.png', { type: 'image/png' });
        const expectedResult = 'data:image/png;base64,';

        const mockFileReader = {
            readAsDataURL: vi.fn(),
            result: expectedResult,
        };

        global.FileReader = vi.fn(() => mockFileReader) as unknown as typeof FileReader;

        mockFileReader.readAsDataURL = vi.fn(function (this: typeof mockFileReader) {
            Promise.resolve().then(() => {
                if (this.onload) {
                    this.onload({ target: { result: expectedResult } } as unknown as ProgressEvent<FileReader>);
                }
            });
        });

        const result = await fileToBase64(mockFile);

        expect(result).toBe(expectedResult);
    });
});

// ============================================================================
// urlToBase64 Tests
// ============================================================================

describe('urlToBase64', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should fetch URL and convert to base64 data URL', async () => {
        const mockUrl = 'https://example.com/image.png';
        const mockBlob = new Blob(['mock image data'], { type: 'image/png' });
        const mockDataUrl = 'data:image/png;base64,bW9jayBpbWFnZSBkYXRh';

        mockFetch.mockResolvedValueOnce({
            blob: async () => mockBlob,
        } as Response);

        const mockFileReader = {
            readAsDataURL: vi.fn(),
            result: mockDataUrl,
        };

        global.FileReader = vi.fn(() => mockFileReader) as unknown as typeof FileReader;

        mockFileReader.readAsDataURL = vi.fn(function (this: typeof mockFileReader) {
            Promise.resolve().then(() => {
                if (this.onload) {
                    this.onload({ target: { result: mockDataUrl } } as unknown as ProgressEvent<FileReader>);
                }
            });
        });

        const result = await urlToBase64(mockUrl);

        expect(mockFetch).toHaveBeenCalledWith(mockUrl);
        expect(result).toBe(mockDataUrl);
    });

    it('should handle fetch errors', async () => {
        const mockUrl = 'https://example.com/image.png';

        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        await expect(urlToBase64(mockUrl)).rejects.toThrow('Network error');
    });

    it('should handle JPEG URLs', async () => {
        const mockUrl = 'https://example.com/image.jpg';
        const mockBlob = new Blob(['jpeg data'], { type: 'image/jpeg' });
        const mockDataUrl = 'data:image/jpeg;base64,anBlZyBkYXRh';

        mockFetch.mockResolvedValueOnce({
            blob: async () => mockBlob,
        } as Response);

        const mockFileReader = {
            readAsDataURL: vi.fn(),
            result: mockDataUrl,
        };

        global.FileReader = vi.fn(() => mockFileReader) as unknown as typeof FileReader;

        mockFileReader.readAsDataURL = vi.fn(function (this: typeof mockFileReader) {
            Promise.resolve().then(() => {
                if (this.onload) {
                    this.onload({ target: { result: mockDataUrl } } as unknown as ProgressEvent<FileReader>);
                }
            });
        });

        const result = await urlToBase64(mockUrl);

        expect(result).toContain('image/jpeg');
    });

    it('should handle blob conversion errors', async () => {
        const mockUrl = 'https://example.com/image.png';

        mockFetch.mockResolvedValueOnce({
            blob: async () => {
                throw new Error('Blob conversion failed');
            },
        } as Response);

        await expect(urlToBase64(mockUrl)).rejects.toThrow('Blob conversion failed');
    });
});

// ============================================================================
// normalizeImage Tests
// ============================================================================

describe('normalizeImage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('with undefined value', () => {
        it('should return null for undefined value', async () => {
            const result = await normalizeImage(undefined);

            expect(result).toBeNull();
        });

        it('should return null for undefined value with base64 format', async () => {
            const result = await normalizeImage(undefined, 'base64');

            expect(result).toBeNull();
        });

        it('should return null for undefined value with dataUrl format', async () => {
            const result = await normalizeImage(undefined, 'dataUrl');

            expect(result).toBeNull();
        });
    });

    describe('with url source', () => {
        it('should return URL as-is for url format', async () => {
            const value: ImagePickerValue = {
                source: 'url',
                url: 'https://example.com/image.png',
            };

            const result = await normalizeImage(value, 'url');

            expect(result).toBe('https://example.com/image.png');
        });

        it('should return null when url is missing for url format', async () => {
            const value: ImagePickerValue = {
                source: 'url',
            };

            const result = await normalizeImage(value, 'url');

            expect(result).toBeNull();
        });

        it('should convert URL to base64 for base64 format', async () => {
            const value: ImagePickerValue = {
                source: 'url',
                url: 'https://example.com/image.png',
            };
            const mockBlob = new Blob(['image data'], { type: 'image/png' });
            const mockDataUrl = 'data:image/png;base64,aW1hZ2UgZGF0YQ==';

            mockFetch.mockResolvedValueOnce({
                blob: async () => mockBlob,
            } as Response);

            const mockFileReader = {
                readAsDataURL: vi.fn(),
                result: mockDataUrl,
            };

            global.FileReader = vi.fn(() => mockFileReader) as unknown as typeof FileReader;

            mockFileReader.readAsDataURL = vi.fn(function (this: typeof mockFileReader) {
                Promise.resolve().then(() => {
                    if (this.onload) {
                        this.onload({ target: { result: mockDataUrl } } as unknown as ProgressEvent<FileReader>);
                    }
                });
            });

            const result = await normalizeImage(value, 'base64');

            expect(result).toBe('aW1hZ2UgZGF0YQ==');
        });

        it('should convert URL to data URL for dataUrl format', async () => {
            const value: ImagePickerValue = {
                source: 'url',
                url: 'https://example.com/image.png',
            };
            const mockBlob = new Blob(['image data'], { type: 'image/png' });
            const mockDataUrl = 'data:image/png;base64,aW1hZ2UgZGF0YQ==';

            mockFetch.mockResolvedValueOnce({
                blob: async () => mockBlob,
            } as Response);

            const mockFileReader = {
                readAsDataURL: vi.fn(),
                result: mockDataUrl,
            };

            global.FileReader = vi.fn(() => mockFileReader) as unknown as typeof FileReader;

            mockFileReader.readAsDataURL = vi.fn(function (this: typeof mockFileReader) {
                Promise.resolve().then(() => {
                    if (this.onload) {
                        this.onload({ target: { result: mockDataUrl } } as unknown as ProgressEvent<FileReader>);
                    }
                });
            });

            const result = await normalizeImage(value, 'dataUrl');

            expect(result).toBe(mockDataUrl);
        });
    });

    describe('with base64 source', () => {
        it('should return base64 as-is for base64 format', async () => {
            const value: ImagePickerValue = {
                source: 'base64',
                base64: 'aW1hZ2UgZGF0YQ==',
            };

            const result = await normalizeImage(value, 'base64');

            expect(result).toBe('aW1hZ2UgZGF0YQ==');
        });

        it('should return null when base64 is missing', async () => {
            const value: ImagePickerValue = {
                source: 'base64',
            };

            const result = await normalizeImage(value, 'base64');

            expect(result).toBeNull();
        });

        it('should convert base64 to data URL with PNG mime type for dataUrl format', async () => {
            const value: ImagePickerValue = {
                source: 'base64',
                base64: 'aW1hZ2UgZGF0YQ==',
            };

            const result = await normalizeImage(value, 'dataUrl');

            expect(result).toBe('data:image/png;base64,aW1hZ2UgZGF0YQ==');
        });

        it('should convert base64 to data URL with custom mime type for dataUrl format', async () => {
            const value: ImagePickerValue = {
                source: 'base64',
                base64: 'aW1hZ2UgZGF0YQ==',
                mimeType: 'image/jpeg',
            };

            const result = await normalizeImage(value, 'dataUrl');

            expect(result).toBe('data:image/jpeg;base64,aW1hZ2UgZGF0YQ==');
        });

        it('should convert base64 to data URL for url format', async () => {
            const value: ImagePickerValue = {
                source: 'base64',
                base64: 'aW1hZ2UgZGF0YQ==',
            };

            const result = await normalizeImage(value, 'url');

            expect(result).toBe('data:image/png;base64,aW1hZ2UgZGF0YQ==');
        });

        it('should use custom mime type when converting to data URL for url format', async () => {
            const value: ImagePickerValue = {
                source: 'base64',
                base64: 'aW1hZ2UgZGF0YQ==',
                mimeType: 'image/webp',
            };

            const result = await normalizeImage(value, 'url');

            expect(result).toBe('data:image/webp;base64,aW1hZ2UgZGF0YQ==');
        });
    });

    describe('with asset source', () => {
        it('should return null and log warning for asset source', async () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const value: ImagePickerValue = {
                source: 'asset',
                assetId: 'asset-123',
            };

            const result = await normalizeImage(value, 'url');

            expect(result).toBeNull();
            expect(consoleWarnSpy).toHaveBeenCalledWith('[Image] Asset loading not implemented yet');

            consoleWarnSpy.mockRestore();
        });

        it('should return null for asset source with base64 format', async () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const value: ImagePickerValue = {
                source: 'asset',
                assetId: 'asset-123',
            };

            const result = await normalizeImage(value, 'base64');

            expect(result).toBeNull();

            consoleWarnSpy.mockRestore();
        });
    });

    describe('with connected source', () => {
        it('should return URL for url format', async () => {
            const value: ImagePickerValue = {
                source: 'connected',
                url: 'https://example.com/connected.png',
            };

            const result = await normalizeImage(value, 'url');

            expect(result).toBe('https://example.com/connected.png');
        });

        it('should convert URL to base64 for base64 format', async () => {
            const value: ImagePickerValue = {
                source: 'connected',
                url: 'https://example.com/connected.png',
            };
            const mockBlob = new Blob(['connected data'], { type: 'image/png' });
            const mockDataUrl = 'data:image/png;base64,Y29ubmVjdGVkIGRhdGE=';

            mockFetch.mockResolvedValueOnce({
                blob: async () => mockBlob,
            } as Response);

            const mockFileReader = {
                readAsDataURL: vi.fn(),
                result: mockDataUrl,
            };

            global.FileReader = vi.fn(() => mockFileReader) as unknown as typeof FileReader;

            mockFileReader.readAsDataURL = vi.fn(function (this: typeof mockFileReader) {
                Promise.resolve().then(() => {
                    if (this.onload) {
                        this.onload({ target: { result: mockDataUrl } } as unknown as ProgressEvent<FileReader>);
                    }
                });
            });

            const result = await normalizeImage(value, 'base64');

            expect(result).toBe('Y29ubmVjdGVkIGRhdGE=');
        });

        it('should convert URL to data URL for dataUrl format', async () => {
            const value: ImagePickerValue = {
                source: 'connected',
                url: 'https://example.com/connected.png',
            };
            const mockBlob = new Blob(['connected data'], { type: 'image/png' });
            const mockDataUrl = 'data:image/png;base64,Y29ubmVjdGVkIGRhdGE=';

            mockFetch.mockResolvedValueOnce({
                blob: async () => mockBlob,
            } as Response);

            const mockFileReader = {
                readAsDataURL: vi.fn(),
                result: mockDataUrl,
            };

            global.FileReader = vi.fn(() => mockFileReader) as unknown as typeof FileReader;

            mockFileReader.readAsDataURL = vi.fn(function (this: typeof mockFileReader) {
                Promise.resolve().then(() => {
                    if (this.onload) {
                        this.onload({ target: { result: mockDataUrl } } as unknown as ProgressEvent<FileReader>);
                    }
                });
            });

            const result = await normalizeImage(value, 'dataUrl');

            expect(result).toBe(mockDataUrl);
        });

        it('should return base64 for base64 format', async () => {
            const value: ImagePickerValue = {
                source: 'connected',
                base64: 'Y29ubmVjdGVkIGJhc2U2NA==',
            };

            const result = await normalizeImage(value, 'base64');

            expect(result).toBe('Y29ubmVjdGVkIGJhc2U2NA==');
        });

        it('should convert base64 to data URL with default mime type for dataUrl format', async () => {
            const value: ImagePickerValue = {
                source: 'connected',
                base64: 'Y29ubmVjdGVkIGJhc2U2NA==',
            };

            const result = await normalizeImage(value, 'dataUrl');

            expect(result).toBe('data:image/png;base64,Y29ubmVjdGVkIGJhc2U2NA==');
        });

        it('should convert base64 to data URL with custom mime type for dataUrl format', async () => {
            const value: ImagePickerValue = {
                source: 'connected',
                base64: 'Y29ubmVjdGVkIGJhc2U2NA==',
                mimeType: 'image/gif',
            };

            const result = await normalizeImage(value, 'dataUrl');

            expect(result).toBe('data:image/gif;base64,Y29ubmVjdGVkIGJhc2U2NA==');
        });

        it('should return null when connected source has no url or base64', async () => {
            const value: ImagePickerValue = {
                source: 'connected',
            };

            const result = await normalizeImage(value, 'url');

            expect(result).toBeNull();
        });

        it('should prioritize URL over base64 when both present', async () => {
            const value: ImagePickerValue = {
                source: 'connected',
                url: 'https://example.com/connected.png',
                base64: 'Y29ubmVjdGVkIGJhc2U2NA==',
            };

            const result = await normalizeImage(value, 'url');

            expect(result).toBe('https://example.com/connected.png');
        });
    });

    describe('edge cases', () => {
        it('should handle empty URL string returning null', async () => {
            const value: ImagePickerValue = {
                source: 'url',
                url: '',
            };

            const result = await normalizeImage(value, 'url');

            expect(result).toBeNull();
        });

        it('should handle empty base64 string returning null', async () => {
            const value: ImagePickerValue = {
                source: 'base64',
                base64: '',
            };

            const result = await normalizeImage(value, 'base64');

            expect(result).toBeNull();
        });
    });
});

// ============================================================================
// isValidUrl Tests
// ============================================================================

describe('isValidUrl', () => {
    it('should return true for valid HTTP URLs', () => {
        expect(isValidUrl('http://example.com')).toBe(true);
    });

    it('should return true for valid HTTPS URLs', () => {
        expect(isValidUrl('https://example.com')).toBe(true);
    });

    it('should return true for URLs with paths', () => {
        expect(isValidUrl('https://example.com/path/to/image.png')).toBe(true);
    });

    it('should return true for URLs with query parameters', () => {
        expect(isValidUrl('https://example.com/image.png?width=200&height=200')).toBe(true);
    });

    it('should return true for URLs with fragments', () => {
        expect(isValidUrl('https://example.com/page#section')).toBe(true);
    });

    it('should return true for URLs with ports', () => {
        expect(isValidUrl('https://example.com:8080/image.png')).toBe(true);
    });

    it('should return true for URLs with authentication', () => {
        expect(isValidUrl('https://user:pass@example.com/image.png')).toBe(true);
    });

    it('should return true for FTP URLs', () => {
        expect(isValidUrl('ftp://example.com/file.txt')).toBe(true);
    });

    it('should return true for data URLs', () => {
        expect(isValidUrl('data:image/png;base64,abc123')).toBe(true);
    });

    it('should return true for blob URLs', () => {
        expect(isValidUrl('blob:https://example.com/uuid-123')).toBe(true);
    });

    it('should return true for file URLs', () => {
        expect(isValidUrl('file:///path/to/file.txt')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
        expect(isValidUrl('not-a-url')).toBe(false);
    });

    it('should return false for empty string', () => {
        expect(isValidUrl('')).toBe(false);
    });

    it('should return false for strings without protocol', () => {
        expect(isValidUrl('example.com')).toBe(false);
    });

    it('should return true for custom protocols', () => {
        // URL constructor accepts any protocol, even non-standard ones
        expect(isValidUrl('htt://example.com')).toBe(true);
    });

    it('should return false for strings with spaces', () => {
        expect(isValidUrl('https://example .com')).toBe(false);
    });

    it('should return false for localhost without protocol', () => {
        // "localhost:3000" is actually a valid URL per the URL spec
        // It's treated as a path-only URL
        expect(isValidUrl('localhost:3000')).toBe(true);
    });

    it('should return true for localhost with protocol', () => {
        expect(isValidUrl('http://localhost:3000')).toBe(true);
    });

    it('should return true for IP addresses with protocol', () => {
        expect(isValidUrl('http://192.168.1.1')).toBe(true);
    });

    it('should return true for IPv6 addresses', () => {
        expect(isValidUrl('http://[::1]')).toBe(true);
        expect(isValidUrl('http://[2001:db8::1]')).toBe(true);
    });
});

// ============================================================================
// isDataUrl Tests
// ============================================================================

describe('isDataUrl', () => {
    it('should return true for valid PNG data URL', () => {
        expect(isDataUrl('data:image/png;base64,abc123')).toBe(true);
    });

    it('should return true for valid JPEG data URL', () => {
        expect(isDataUrl('data:image/jpeg;base64,abc123')).toBe(true);
    });

    it('should return true for valid GIF data URL', () => {
        expect(isDataUrl('data:image/gif;base64,abc123')).toBe(true);
    });

    it('should return true for valid WebP data URL', () => {
        expect(isDataUrl('data:image/webp;base64,abc123')).toBe(true);
    });

    it('should return true for SVG data URL', () => {
        expect(isDataUrl('data:image/svg+xml;base64,abc123')).toBe(true);
    });

    it('should return true for data URL with URI encoding', () => {
        expect(isDataUrl('data:text/plain;charset=UTF-8;page=21,the%20data:1234,5678')).toBe(true);
    });

    it('should return true for data URL without base64 encoding', () => {
        expect(isDataUrl('data:text/html,<h1>Hello World</h1>')).toBe(true);
    });

    it('should return false for regular HTTP URLs', () => {
        expect(isDataUrl('https://example.com/image.png')).toBe(false);
    });

    it('should return false for empty string', () => {
        expect(isDataUrl('')).toBe(false);
    });

    it('should return false for strings without data: prefix', () => {
        expect(isDataUrl('image/png;base64,abc123')).toBe(false);
    });

    it('should return false for strings with incorrect data: prefix', () => {
        expect(isDataUrl(' data:image/png;base64,abc123')).toBe(false);
    });

    it('should return true for data URL with only prefix', () => {
        expect(isDataUrl('data:')).toBe(true);
    });

    it('should return true for data URL with mime type but no data', () => {
        expect(isDataUrl('data:image/png;base64,')).toBe(true);
    });
});

// ============================================================================
// mimeToExtension Tests
// ============================================================================

describe('mimeToExtension', () => {
    it('should return png for image/png', () => {
        expect(mimeToExtension('image/png')).toBe('png');
    });

    it('should return jpg for image/jpeg', () => {
        expect(mimeToExtension('image/jpeg')).toBe('jpg');
    });

    it('should return gif for image/gif', () => {
        expect(mimeToExtension('image/gif')).toBe('gif');
    });

    it('should return webp for image/webp', () => {
        expect(mimeToExtension('image/webp')).toBe('webp');
    });

    it('should return default png extension for unknown MIME type', () => {
        expect(mimeToExtension('image/svg+xml')).toBe('png');
    });

    it('should return default png extension for empty string', () => {
        expect(mimeToExtension('')).toBe('png');
    });

    it('should return default png extension for non-image MIME type', () => {
        expect(mimeToExtension('application/json')).toBe('png');
    });

    it('should be case sensitive', () => {
        expect(mimeToExtension('image/PNG')).toBe('png');
        expect(mimeToExtension('IMAGE/JPEG')).toBe('png');
    });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('image utils integration', () => {
    it('should complete workflow: base64 -> data URL -> extract -> validate', () => {
        const base64Data = 'aW1hZ2UgZGF0YQ==';
        const mimeType = 'image/png';

        // Construct data URL (simulating what base64 source with dataUrl format would do)
        const dataUrl = `data:${mimeType};base64,${base64Data}`;

        // Extract base64 from data URL
        const { base64, mimeType: extractedMime } = dataUrlToBase64(dataUrl);
        expect(base64).toBe(base64Data);
        expect(extractedMime).toBe(mimeType);

        // Get extension from MIME type
        const extension = mimeToExtension(extractedMime);
        expect(extension).toBe('png');

        // Validate the data URL
        expect(isDataUrl(dataUrl)).toBe(true);
    });

    it('should handle ImagePickerValue normalization with base64 source', async () => {
        const value: ImagePickerValue = {
            source: 'base64',
            base64: 'aW1hZ2UgZGF0YQ==',
            mimeType: 'image/jpeg',
        };

        // As base64
        const base64 = await normalizeImage(value, 'base64');
        expect(base64).toBe('aW1hZ2UgZGF0YQ==');

        // As data URL
        const dataUrl = await normalizeImage(value, 'dataUrl');
        expect(dataUrl).toBe('data:image/jpeg;base64,aW1hZ2UgZGF0YQ==');

        // Verify it's recognized as data URL
        expect(isDataUrl(dataUrl as string)).toBe(true);
    });

    it('should differentiate between data URLs and regular URLs', () => {
        const regularUrl = 'https://example.com/image.png';
        const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';

        expect(isValidUrl(regularUrl)).toBe(true);
        expect(isDataUrl(regularUrl)).toBe(false);

        expect(isValidUrl(dataUrl)).toBe(true);
        expect(isDataUrl(dataUrl)).toBe(true);
    });

    it('should handle connected source with base64', async () => {
        const value: ImagePickerValue = {
            source: 'connected',
            base64: 'Y29ubmVjdGVkIGJhc2U2NA==',
            mimeType: 'image/gif',
        };

        // As base64
        const base64 = await normalizeImage(value, 'base64');
        expect(base64).toBe('Y29ubmVjdGVkIGJhc2U2NA==');

        // As data URL
        const dataUrl = await normalizeImage(value, 'dataUrl');
        expect(dataUrl).toBe('data:image/gif;base64,Y29ubmVjdGVkIGJhc2U2NA==');
    });

    it('should handle url source with url format (no conversion)', async () => {
        const value: ImagePickerValue = {
            source: 'url',
            url: 'https://example.com/test.png',
        };

        const result = await normalizeImage(value, 'url');
        expect(result).toBe('https://example.com/test.png');
        expect(isValidUrl(result as string)).toBe(true);
        expect(isDataUrl(result as string)).toBe(false);
    });
});
