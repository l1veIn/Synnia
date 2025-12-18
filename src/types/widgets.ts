// ==========================================
// Synnia Widget System Definitions
// ==========================================

/**
 * All supported widget types in the system.
 * - Basic: Standard HTML inputs
 * - Advanced: Rich UI components
 * - System: Internal system components
 */
export type WidgetType =
    // Basic Text
    | 'text'              // Single line input
    | 'textarea'          // Multi-line input
    | 'password'          // Masked input

    // Numeric
    | 'number'            // Standard number input
    | 'slider'            // Slider with input

    // Selection / Boolean
    | 'switch'            // Boolean toggle
    | 'select'            // Dropdown select
    | 'color'             // Color picker

    // Visual / Media (New)
    | 'media-model-selector'  // Media model dropdown with filtering (simple)
    | 'model-configurator'    // Model selector + dynamic model-specific params (compound)
    | 'aspect-ratio-selector' // Visual aspect ratio picker
    | 'image-picker'          // Image upload/URL/asset selection

    // Advanced (Proposed/Future)
    | 'code-editor'       // Monaco/CodeMirror editor
    | 'file-upload'       // Drag-and-drop file upload
    | 'prompt-enhancer'   // Textarea with AI enhancement button
    | 'lora-selector'     // LoRA model selector
    | 'llm-configurator'  // LLM model selector + params

    // System
    | 'node-input'        // Graph node connection point
    | 'none';             // Headless/Hidden

/**
 * Configuration options interface for widgets that strictly need them.
 * Note: Most widget config currently lives in FieldRule (min, max, options etc.)
 * This interface is for future expansion of widget-specific config.
 */
export interface WidgetConfig {
    placeholder?: string;
    // ... specialized config
}
