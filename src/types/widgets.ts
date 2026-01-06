// ==========================================
// Synnia Widget System Definitions
// ==========================================

/**
 * All supported widget types in the system.
 * - Basic: Standard HTML inputs
 * - Advanced: Rich UI components  
 * - Connection: Data input from other nodes
 */
export type WidgetType =
    // Basic Text
    | 'text'              // Single line input
    | 'textarea'          // Multi-line text with AI enhancement + editor
    | 'password'          // Masked input

    // Numeric
    | 'number'            // Standard number input
    | 'slider'            // Slider with value display

    // Selection / Boolean
    | 'switch'            // Boolean toggle
    | 'select'            // Dropdown select
    | 'segmented'         // Horizontal toggle group
    | 'color'             // Color picker
    | 'tags'              // Multi-tag input

    // Visual / Media
    | 'aspect-ratio-selector' // Visual aspect ratio picker
    | 'image-picker'          // Image upload/URL/asset selection

    // Connection Inputs (receive data from other nodes)
    | 'form-input'        // Object connection input (expects single object)
    | 'table-input'       // Array connection input (expects array of objects)

    // Reserved (future)
    // | 'code-editor'     // Monaco/CodeMirror editor
    // | 'file-upload'     // Drag-and-drop file upload
    // | 'lora-selector'   // LoRA model selector

    // System
    | 'none';             // Headless/Hidden

// Note: Widget-specific config is defined within each Widget implementation.
// FieldDefinition.config uses Record<string, any> and each Widget casts it
// to its own strongly-typed config interface internally.
