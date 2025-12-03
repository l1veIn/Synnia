import { 
    CustomMenuItem, 
    CustomMenuSeparator, 
    CustomMenuLabel 
} from "@/components/ui/custom-menu";
import { getRecipesForAsset, RECIPES } from '@/config/recipeRegistry';
import { Wand2, Link } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore'; 

interface RecipePickerMenuProps {
    sourceNodeId?: string;
    onRunRecipe: (recipeId: string, sourceNodeId?: string) => void;
    onClose: () => void;
}

export function RecipePickerMenu({ sourceNodeId, onRunRecipe, onClose }: RecipePickerMenuProps) {
    
    const nodes = useProjectStore(state => state.nodes);
    const createShortcut = useProjectStore(state => state.createShortcut);
    
    let recipes = RECIPES;
    let showReference = false;

    if (sourceNodeId) {
        const sourceNode = nodes.find(n => n.id === sourceNodeId);
        if (sourceNode) {
            recipes = getRecipesForAsset(sourceNode.data.assetType);
            showReference = true;
        }
    }

    const handleRecipe = (id: string) => {
        onRunRecipe(id, sourceNodeId);
        onClose();
    };

    const handleCreateReference = () => {
        if (sourceNodeId) {
            createShortcut(sourceNodeId);
        }
        onClose();
    };

    return (
        <>
            <CustomMenuLabel className="text-xs uppercase text-muted-foreground tracking-wider">
                {sourceNodeId ? "Connect & Process" : "New Recipe Node"}
            </CustomMenuLabel>

            {showReference && (
                <>
                    <CustomMenuItem onClick={handleCreateReference}>
                        <Link className="w-4 h-4 mr-2" />
                        Create Reference (Shortcut)
                    </CustomMenuItem>
                    <CustomMenuSeparator />
                </>
            )}

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