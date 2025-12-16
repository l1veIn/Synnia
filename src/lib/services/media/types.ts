// Media Generation Types

export type MediaType = 'image' | 'video' | 'audio';

export interface MediaProvider {
    id: string;
    name: string;
    type: 'openai' | 'fal' | 'replicate' | 'comfyui' | 'custom';
    mediaTypes: MediaType[];
    baseUrl?: string;
    apiKey?: string;
    isDefault?: boolean;
}

export interface MediaConfig {
    providers: MediaProvider[];
    defaultImageProvider?: string;
    defaultVideoProvider?: string;
    defaultAudioProvider?: string;
}

// Image Generation
export interface GenerateImageParams {
    prompt: string;
    model?: string;
    size?: string;          // "1024x1024" or "16:9"
    n?: number;             // Number of images
    negativePrompt?: string;
    images?: string[];      // For img2img (base64 or URL)
    seed?: number;
    providerId?: string;
    onProgress?: (status: ProgressStatus) => void;
}

export interface ImageResult {
    success: boolean;
    images?: GeneratedImage[];
    error?: string;
    wasTruncated?: boolean;
}

export interface GeneratedImage {
    url: string;            // Display URL (blob: or https:)
    filePath?: string;      // Local file path
    base64?: string;        // Raw base64 data
    width?: number;
    height?: number;
}

// Video Generation  
export interface GenerateVideoParams {
    prompt: string;
    model?: string;
    mode?: 'text-to-video' | 'image-to-video' | 'video-to-video';
    duration?: number;
    aspectRatio?: string;
    images?: string[];      // For i2v
    videos?: string[];      // For v2v
    providerId?: string;
    onProgress?: (status: ProgressStatus) => void;
}

export interface VideoResult {
    success: boolean;
    url?: string;
    filePath?: string;
    taskId?: string;        // For async tasks
    error?: string;
}

// Audio Generation
export interface GenerateAudioParams {
    text: string;
    model?: string;
    voice?: string;
    providerId?: string;
    onProgress?: (status: ProgressStatus) => void;
}

export interface AudioResult {
    success: boolean;
    url?: string;
    filePath?: string;
    error?: string;
}

// Progress Status
export interface ProgressStatus {
    status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    progress?: number;      // 0-100
    message?: string;
    queuePosition?: number;
}
