import { 
    CustomMenuItem, 
    CustomMenuSeparator, 
    CustomMenuLabel 
} from "@/components/ui/custom-menu";
import { getRecipesForAsset } from '@/config/recipeRegistry';
import { Wand2, Link } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore'; // To access nodes

interface RecipePickerMenuProps {
    sourceNodeId: string;
    onRunRecipe: (recipeId: string, sourceNodeId: string) => void;
    onClose: () => void;
}

export function RecipePickerMenu({ sourceNodeId, onRunRecipe, onClose }: RecipePickerMenuProps) {
    
    const nodes = useProjectStore(state => state.nodes);
    const createShortcut = useProjectStore(state => state.createShortcut); // Access createShortcut
    const sourceNode = nodes.find(n => n.id === sourceNodeId);
    
    if (!sourceNode) return null;

    const assetType = sourceNode.data.assetType;
    const recipes = getRecipesForAsset(assetType);

    const handleRecipe = (id: string) => {
        onRunRecipe(id, sourceNodeId);
        onClose();
    };

    const handleCreateReference = () => {
        // Create shortcut slightly offset from original, or we might want to pass the drop position?
        // The menu position is usually where the user dropped. 
        // But createShortcut currently uses a simple offset or passed position.
        // For now, we let the store decide or simple offset.
        // To be precise, we should pass the drop position if we had it here.
        // Since we don't have exact drop coords in props easily without passing them down,
        // we'll rely on default offset for now.
        createShortcut(sourceNodeId);
        onClose();
    };

    return (
        <>
            <CustomMenuLabel className="text-xs uppercase text-muted-foreground tracking-wider">
                Connect & Process
            </CustomMenuLabel>

            <CustomMenuItem onClick={handleCreateReference}>
                <Link className="w-4 h-4 mr-2" />
                Create Reference (Shortcut)
            </CustomMenuItem>
            
            <CustomMenuSeparator />

            {recipes.length > 0 ? (
                <>
                    <CustomMenuLabel className="text-xs flex items-center text-blue-500">
                         <Wand2 className="w-3 h-3 mr-2" /> Available Recipes
                    </CustomMenuLabel>
                    {recipes.map(recipe => (
                        <CustomMenuItem key={recipe.id} onClick={() => handleRecipe(recipe.id)}>
                            {recipe.icon && <recipe.icon className="w-3 h-3 mr-2 opacity-70" />}
                            {recipe.label}
                        </CustomMenuItem>
                    ))}
                </>
            ) : (
                <CustomMenuItem disabled>
                    <span className="text-xs text-muted-foreground">No compatible recipes</span>
                </CustomMenuItem>
            )}
        </>
    );
}