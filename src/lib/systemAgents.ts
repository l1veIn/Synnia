import { AgentDefinition } from "@/types/project";

// ==========================================
// AGENT A: THE ARCHITECT (NAMING)
// ==========================================
const NAMING_INPUT_SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    productType: { type: "string", title: "Product Type", description: "e.g. Energy Drink, SaaS Platform" },
    targetAudience: { type: "string", title: "Target Audience", description: "e.g. Gen Z Gamers" },
    brandTone: { type: "string", title: "Brand Tone", description: "e.g. Edgy, Professional, Cute" },
    culturalBackground: { type: "string", title: "Cultural Context", description: "e.g. Cyberpunk Tokyo" },
    language: { type: "string", enum: ["en", "zh"], title: "Language", default: "en" }
  },
  required: ["productType", "targetAudience", "brandTone"]
});

const NAMING_SYSTEM_PROMPT = `
You are a World-Class Virtual IP Architect and Character Naming Specialist.
Your task is to name the Virtual Character/Mascot that represents the brand.

NAMING STRATEGY: THE RELEVANCE SPECTRUM
Generate names organized by how closely they relate to the product function:

1. **[#1-3] Closely Related (Functional/Descriptive)**:
    - Directly hints at what the product does. Safe, approachable, clear.
2. **[#4-6] Associative / Metaphorical**:
    - Connects via feelings, personality, or indirect symbols.
3. **[#7-9] Abstract / High Concept**:
    - Completely unique, coined words, or arbitrary nouns that sound great.

RULES:
- Rationale: Explain the soul behind the name.
- Tagline: A catchphrase spoken by the character.
`;

// ==========================================
// AGENT B: THE STORYTELLER (PERSONA)
// ==========================================
const PERSONA_INPUT_SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    brandInput: { 
        type: "object",
        title: "Brand Context",
        properties: {
             productType: { type: "string" },
             brandTone: { type: "string" }
        }
    },
    selectedName: { 
        type: "object",
        title: "Identity Anchor",
        properties: {
            name: { type: "string" },
            rationale: { type: "string" }
        }
    }
  },
  required: ["brandInput", "selectedName"]
});

const PERSONA_SYSTEM_PROMPT = `
You are a Visionary Creative Director and Storyteller.
Create a deep, detailed character profile (Soul Profile) for a brand's virtual IP based on the provided name.

TASK:
Flesh out this character. They should be the "Soulmate" of the brand.
- **Visual DNA**: Precise text description of Hair, Outfit, Accessories.
- **Personality**: Voice style, traits.
- **Brand Synergy**: How the character represents the product.
- **Color Palette**: Define a 4-color palette (Primary, Secondary, Accent, Background HEX codes).
`;

// ==========================================
// AGENT C: THE PRODUCT MANAGER (PLANNING)
// ==========================================
const PLANNING_INPUT_SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    soulProfile: { 
        type: "object",
        title: "Soul Profile",
        description: "The full persona JSON data."
    },
    productType: { type: "string", title: "Product Type" },
    visualStyle: { type: "string", title: "Visual Style", description: "e.g. 3D Blind Box, Cyberpunk, Watercolor" }
  },
  required: ["soulProfile", "productType", "visualStyle"]
});

const PLANNING_SYSTEM_PROMPT = `
You are a Senior Product Manager for a top-tier digital product.
Your goal is to plan a "Visual Asset Kit" (Production Manifest) for the development team.

LOGIC:
1. **Contextual Analysis**: Analyze the Product Type (App, Game, Marketing?).
2. **Asset Selection**: Select necessary assets from the Taxonomy (Grid, Marketing, Merch, Game, Texture).
3. **Copywriting**: Write "Micro-Copy" (Dialogue) for each asset based on the Persona's voice.

OUTPUT:
A JSON list of Asset Concepts (id, type, label, description, copywriting).
`;

// ==========================================
// AGENT D: THE ART DIRECTOR (PROMPTING)
// ==========================================
const PROMPTING_INPUT_SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    manifest: { 
        type: "array", 
        title: "Production Manifest",
        items: { type: "object" }
    },
    soulProfile: { type: "object", title: "Soul Profile" },
    visualStyle: { type: "string", title: "Visual Style" }
  },
  required: ["manifest", "soulProfile"]
});

const PROMPTING_SYSTEM_PROMPT = `
You are an Art Director and Prompt Engineer for AI Image Generation (Midjourney/Gemini).

YOUR JOB:
Convert the "Production Manifest" into detailed, high-quality Image Generation Prompts (Visual Blueprints).

CRITICAL INSTRUCTIONS:
1. **Visual Anchoring**: Inject the Soul Profile's Visual DNA into every prompt.
2. **Style Injection**: Apply the Visual Style modifiers.
3. **Color Injection**: Enforce the Color Palette.
4. **Constraint Enforcement**: No text, specific aspect ratios.

OUTPUT:
A JSON list of Visual Blueprints (id, prompt, negative_prompt, aspect_ratio).
`;

export const SYSTEM_AGENTS: AgentDefinition[] = [
    {
        id: "sys_architect",
        name: "The Architect (Naming)",
        description: "Phase 1: Semiotics & Naming Strategy. Generates the naming matrix.",
        systemPrompt: NAMING_SYSTEM_PROMPT,
        inputSchema: NAMING_INPUT_SCHEMA,
        outputConfig: JSON.stringify({ format: "json", targetNode: "Data" }),
        isSystem: true
    },
    {
        id: "sys_storyteller",
        name: "The Storyteller (Persona)",
        description: "Phase 2: Character Design. Fleshes out the name into a Soul Profile with Visual DNA.",
        systemPrompt: PERSONA_SYSTEM_PROMPT,
        inputSchema: PERSONA_INPUT_SCHEMA,
        outputConfig: JSON.stringify({ format: "json", targetNode: "Data" }),
        isSystem: true
    },
    {
        id: "sys_pm",
        name: "The Product Manager",
        description: "Phase 3: Requirements Analysis. Plans the Asset Manifest based on product needs.",
        systemPrompt: PLANNING_SYSTEM_PROMPT,
        inputSchema: PLANNING_INPUT_SCHEMA,
        outputConfig: JSON.stringify({ format: "json", targetNode: "Data" }),
        isSystem: true
    },
    {
        id: "sys_art_director",
        name: "The Art Director",
        description: "Phase 4: Prompt Engineering. Converts the manifest into executable Visual Blueprints.",
        systemPrompt: PROMPTING_SYSTEM_PROMPT,
        inputSchema: PROMPTING_INPUT_SCHEMA,
        outputConfig: JSON.stringify({ format: "json", targetNode: "Data" }),
        isSystem: true
    }
];
