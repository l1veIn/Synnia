import { 
    CustomMenuItem, 
    CustomMenuSeparator, 
    CustomMenuLabel
} from "@/components/ui/custom-menu";
import { AssetData, AgentDefinition } from '@/types/project';
import { getRecipesForAsset } from '@/config/recipeRegistry';
import { Wand2, Trash2, Layers, ImageMinus, Link, Unlink, RefreshCw } from 'lucide-react'; // Added RefreshCw
import { toast } from 'sonner';
import { useProjectStore } from '@/store/projectStore'; 

interface NodeMenuProps {
    node: { id: string, data: AssetData };
    agents: AgentDefinition[];
    onRunRecipe: (recipeId: string, sourceNodeId: string) => void;
    onCallAgent: (agent: AgentDefinition) => void;
    onRemoveBackground: () => void;
    onSetCover: () => void;
    onDelete: () => void;
    onClose: () => void;
}

export function NodeMenu({ 
    node, 
    onRunRecipe, 
    onRemoveBackground, onSetCover, onDelete, onClose 
}: NodeMenuProps) {
    
    const createShortcut = useProjectStore(state => state.createShortcut);
    const relinkShortcut = useProjectStore(state => state.relinkShortcut); 
    const remakeNode = useProjectStore(state => state.remakeNode);
    const detachNode = useProjectStore(state => state.detachNode); // Use specialized action
    const nodes = useProjectStore(state => state.nodes); 
    
    const assetType = node.data.assetType;
    const isShortcut = assetType === 'reference_asset';
    const canRemake = !!node.data.provenance && !isShortcut; // Can remake if it has history (and not shortcut)
    
    // Determine Broken State
    let isBroken = false;
    if (isShortcut) {
        const targetId = node.data.properties?.targetId as string;
        isBroken = !nodes.find(n => n.id === targetId);
    }

    let effectiveType = assetType;
    if (isShortcut && !isBroken) {
        const targetId = node.data.properties?.targetId as string;
        const target = nodes.find(n => n.id === targetId);
        if (target) effectiveType = target.data.assetType;
    }

    const recipes = getRecipesForAsset(effectiveType);

    const handleRecipe = (id: string) => {
        onRunRecipe(id, node.id); 
        onClose();
    };

    const handleShortcut = () => {
        createShortcut(node.id); 
        onClose();
    }
    
    const handleRemake = () => {
        remakeNode(node.id);
        onClose();
    }

    const handleDetach = () => {
        detachNode(node.id);
        onClose();
    }

    const handleRelink = () => {
        const candidate = nodes.find(n => n.id !== node.id && n.data.assetType !== 'reference_asset');
        if (candidate) {
            relinkShortcut(node.id, candidate.id);
        } else {
            toast.error("No other nodes available to relink");
        }
        onClose();
    }

    return (
        <>
             <CustomMenuLabel className="text-xs uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                {isBroken ? <><Unlink className="w-3 h-3 text-red-500"/> Broken Shortcut</> : "Node Actions"}
            </CustomMenuLabel>
            
            {/* Remake (High Priority) */}
            {canRemake && (
                <>
                    <CustomMenuItem onClick={handleRemake}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Remake
                    </CustomMenuItem>
                    <CustomMenuItem onClick={handleDetach}>
                        <Unlink className="w-4 h-4 mr-2 opacity-70" />
                        Detach (Flatten)
                    </CustomMenuItem>
                    <CustomMenuSeparator />
                </>
            )}
            
            {/* 0. Shortcut (Top Priority) */}
            {!isBroken && (
                <CustomMenuItem onClick={handleShortcut}>
                    <Link className="w-4 h-4 mr-2" />
                    Create Shortcut
                </CustomMenuItem>
            )}

            {/* Relink Option for Shortcuts */}
            {isShortcut && (
                <CustomMenuItem onClick={handleRelink}>
                    <Unlink className="w-4 h-4 mr-2" />
                    {isBroken ? "Repair Link (Random)" : "Relink to..."}
                </CustomMenuItem>
            )}

            <CustomMenuSeparator />

            {/* 1. Recipes */}
            {!isBroken && recipes.length > 0 ? (
                <>
                    <CustomMenuLabel className="text-xs flex items-center text-blue-500">
                         <Wand2 className="w-3 h-3 mr-2" /> Recipes
                    </CustomMenuLabel>
                    {recipes.map(recipe => (
                        <CustomMenuItem key={recipe.id} onClick={() => handleRecipe(recipe.id)}>
                            {recipe.icon && <recipe.icon className="w-3 h-3 mr-2 opacity-70" />}
                            {recipe.label}
                        </CustomMenuItem>
                    ))}
                    <CustomMenuSeparator />
                </>
            ) : (
                <>
                     <CustomMenuItem disabled className="text-muted-foreground">
                        <span className="text-xs pl-6">
                            {isBroken ? "Fix link to run recipes" : "No recipes available"}
                        </span>
                    </CustomMenuItem>
                    <CustomMenuSeparator />
                </>
            )}

            {/* 2. Image Specific */}
            {(effectiveType === 'image_asset' || effectiveType === 'Image') && !isBroken && (
                <>
                    <CustomMenuItem onClick={() => { onRemoveBackground(); onClose(); }}>
                        <ImageMinus className="w-4 h-4 mr-2" />
                        Remove Background
                    </CustomMenuItem>
                    <CustomMenuItem onClick={() => { onSetCover(); onClose(); }}>
                        <Layers className="w-4 h-4 mr-2" />
                        Set as Cover
                    </CustomMenuItem>
                    <CustomMenuSeparator />
                </>
            )}
            
            {/* 3. Edit */}
            <CustomMenuItem onClick={() => { onDelete(); onClose(); }} className="text-destructive focus:text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
            </CustomMenuItem>
        </>
    );
}
