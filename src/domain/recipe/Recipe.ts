import type { FieldDefinition } from '@/types/assets';
import type { RecipeManifest } from '@/types/recipe';

/**
 * Recipe Domain Entity
 *
 * Represents a Recipe definition in the domain layer.
 * The execute logic is handled by Application Layer (RunRecipeUseCase),
 * not embedded in this entity.
 */
export interface Recipe {
    /** Unique identifier */
    id: string;

    /** Display name */
    name: string;

    /** Optional description */
    description?: string;

    /** Category for UI grouping (e.g. "创意工具", "媒体生成") */
    category?: string;

    /** Input field definitions */
    inputSchema: FieldDefinition[];

    /** Output field definitions (optional) */
    outputSchema?: FieldDefinition[];

    /** Full manifest configuration */
    manifest: RecipeManifest;
}

/**
 * Factory function to create a Recipe from manifest
 */
export function createRecipe(manifest: RecipeManifest, inputSchema: FieldDefinition[]): Recipe {
    return {
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        category: manifest.category,
        inputSchema,
        outputSchema: manifest.output?.schema,
        manifest,
    };
}
