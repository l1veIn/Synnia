import { Button } from '@/components/ui/button';
import { 
    Home, Type, Image as ImageIcon, Terminal, 
    MousePointer2, Hand, Undo, Redo, Maximize, Grip, Loader2, Save
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/store/projectStore';
import { useStore } from 'zustand'; // Correct import
import { ASSET_TYPES } from '@/config/menuRegistry';

interface CanvasToolbarProps {
    activeTool: 'select' | 'hand';
    onToolChange: (tool: 'select' | 'hand') => void;
    onAddNode: (type: string, initialData?: any) => void;
    onImportImage: () => void;
    onLayout: () => void;
    onFitView: () => void;
}

export function CanvasToolbar({ 
    activeTool, onToolChange,
    onAddNode, onImportImage,
    onLayout, onFitView,
}: CanvasToolbarProps) {
    const navigate = useNavigate();
    
    // Access Undo/Redo
    const { undo, redo, pastStates, futureStates } = useStore(useProjectStore.temporal, (state) => state);
    const canUndo = pastStates.length > 0;
    const canRedo = futureStates.length > 0;

    // Access Store State
    const isSaving = useProjectStore((state) => state.isSaving);
    const saveProject = useProjectStore((state) => state.saveProject);

    const handleAdd = (registryId: string) => {
        const def = ASSET_TYPES[registryId];
        if (def) {
            onAddNode(registryId, def.initialData);
        } else {
            // Fallback for non-registry calls if any
            onAddNode(registryId);
        }
    };

    return (
        <TooltipProvider delayDuration={300}>
            <div className="h-14 border-b flex items-center px-4 gap-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 shadow-sm shrink-0 select-none">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground mr-2" onClick={() => navigate('/')}>
                            <Home className="w-5 h-5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Back to Dashboard</TooltipContent>
                </Tooltip>
                
                <Separator orientation="vertical" className="h-6 mx-1" />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 opacity-70 hover:opacity-100" 
                            onClick={() => saveProject()}
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Save Project (Ctrl+S)</TooltipContent>
                </Tooltip>

                <Separator orientation="vertical" className="h-6 mx-1" />

                <div className="flex items-center gap-0.5 mr-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-70" onClick={() => undo()} disabled={!canUndo}>
                                <Undo className="w-4 h-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Undo (Ctrl+Z)</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-70" onClick={() => redo()} disabled={!canRedo}>
                                <Redo className="w-4 h-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Redo (Ctrl+Shift+Z)</TooltipContent>
                    </Tooltip>
                </div>

                <Separator orientation="vertical" className="h-6 mx-1" />

                <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border/50">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button 
                                variant={activeTool === 'select' ? 'secondary' : 'ghost'} 
                                size="icon" 
                                className={cn("h-8 w-8 transition-all", activeTool === 'select' && "bg-background shadow-sm text-primary")}
                                onClick={() => onToolChange('select')}
                            >
                                <MousePointer2 className="w-4 h-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Select Mode (V)</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button 
                                variant={activeTool === 'hand' ? 'secondary' : 'ghost'} 
                                size="icon" 
                                className={cn("h-8 w-8 transition-all", activeTool === 'hand' && "bg-background shadow-sm text-primary")}
                                onClick={() => onToolChange('hand')}
                            >
                                <Hand className="w-4 h-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Hand Mode (H)</TooltipContent>
                    </Tooltip>
                </div>

                <Separator orientation="vertical" className="h-6 mx-1" />

                <div className="flex items-center gap-1">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent" onClick={() => handleAdd("text_asset")}>
                                <Type className="w-4 h-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Text Note</TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent" onClick={onImportImage}>
                                <ImageIcon className="w-4 h-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Image</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent" onClick={() => handleAdd("prompt_asset")}>
                                <Terminal className="w-4 h-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">AI Prompt</TooltipContent>
                    </Tooltip>
                </div>
                
                <div className="flex-1" />

                <div className="flex items-center gap-3">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={onFitView}>
                                <Maximize className="w-4 h-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Fit View (Shift+1)</TooltipContent>
                    </Tooltip>

                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={onLayout}>
                        <Grip className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </TooltipProvider>
    );
}