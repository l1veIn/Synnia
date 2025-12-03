import { Fragment } from 'react';
import { 
    CustomMenuItem, 
    CustomMenuSeparator, 
    CustomMenuLabel 
} from "@/components/ui/custom-menu";
import { CONTEXT_MENU_STRUCTURE, MenuItem, ASSET_TYPES } from '@/config/menuRegistry';
import { toast } from 'sonner';

import { Wand2 } from 'lucide-react';

interface PaneMenuProps {
    onAddNode: (type: string, initialData?: any) => void;
    onImportImage: () => void;
    onOpenRecipePicker: () => void; // New Prop
    onClose: () => void;
}

export function PaneMenu({ onAddNode, onImportImage, onOpenRecipePicker, onClose }: PaneMenuProps) {

    const handleAction = (item: MenuItem) => {
        if (item.action === 'import' && item.assetTypeId === 'image_asset') {
            onImportImage();
        } else if (item.action === 'create' && item.assetTypeId) {
            const def = ASSET_TYPES[item.assetTypeId];
            if (def) onAddNode(def.id, def.initialData);
        } else if (item.action === 'dialog') {
             if (item.assetTypeId === 'image_asset') onImportImage();
             else {
                 const def = ASSET_TYPES[item.assetTypeId!];
                 onAddNode(def.id, def.initialData);
                 toast.info(`${item.label} dialog coming soon`);
             }
        }
        onClose();
    };

    const renderMenuItem = (item: MenuItem) => {
        if (item.type === 'separator') return <CustomMenuSeparator key={item.id} />;
        
        const Icon = item.icon;
        
        // Flatten Groups for simplicity in Custom Menu
        if (item.children) {
            return (
                <Fragment key={item.id}>
                    <CustomMenuSeparator />
                    <CustomMenuLabel className="text-xs uppercase text-muted-foreground tracking-wider">
                        {item.label}
                    </CustomMenuLabel>
                    {item.children.map(child => renderMenuItem(child))}
                </Fragment>
            );
        }

        return (
            <CustomMenuItem 
                key={item.id} 
                onClick={() => handleAction(item)}
                className="justify-between"
            >
                <div className="flex items-center">
                    {Icon && <Icon className="w-4 h-4 mr-2" />}
                    {item.label}
                </div>
                {item.shortcut && <span className="text-xs text-muted-foreground ml-4">{item.shortcut}</span>}
            </CustomMenuItem>
        );
    };

    return (
        <>
            <CustomMenuLabel className="text-xs uppercase text-muted-foreground tracking-wider">
                Create New Asset
            </CustomMenuLabel>
            {CONTEXT_MENU_STRUCTURE.map(item => renderMenuItem(item))}
            
            <CustomMenuSeparator />
            <CustomMenuItem 
                onClick={() => { onOpenRecipePicker(); onClose(); }}
                className="justify-between"
            >
                <div className="flex items-center text-primary">
                    <Wand2 className="w-4 h-4 mr-2" />
                    Browse Recipes...
                </div>
            </CustomMenuItem>
        </>
    );
}