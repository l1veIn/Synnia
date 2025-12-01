import { Button } from '@/components/ui/button';
import { 
    Home, Trash2, Type, Image as ImageIcon, Terminal, 
    MousePointer2, Hand, Undo, Redo, Maximize, Grip, Loader2, Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface CanvasToolbarProps {
    activeTool: 'select' | 'hand';
    syncStatus: 'saved' | 'saving' | 'error';
    onToolChange: (tool: 'select' | 'hand') => void;
    onAddNode: (type: string) => void;
    onImportImage: () => void;
    onLayout: () => void;
    onFitView: () => void;
    onUndo: () => void;
    onRedo: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
}

export function CanvasToolbar({ 
    activeTool, syncStatus, onToolChange,
    onAddNode, onImportImage,
    onLayout, onFitView,
    onUndo, onRedo,
    canUndo = false, canRedo = false
}: CanvasToolbarProps) {
    const navigate = useNavigate();

    return (
        <TooltipProvider delayDuration={300}>
            <div className="h-14 border-b flex items-center px-4 gap-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 shadow-sm shrink-0 select-none">
                {/* Home */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground mr-2" onClick={() => navigate('/')}>
                            <Home className="w-5 h-5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Back to Dashboard</TooltipContent>
                </Tooltip>
                
                <Separator orientation="vertical" className="h-6 mx-1" />

                {/* History Group */}
                <div className="flex items-center gap-0.5 mr-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-70" onClick={onUndo} disabled={!canUndo}>
                                <Undo className="w-4 h-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Undo (Ctrl+Z)</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-70" onClick={onRedo} disabled={!canRedo}>
                                <Redo className="w-4 h-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Redo (Ctrl+Shift+Z)</TooltipContent>
                    </Tooltip>
                </div>

                <Separator orientation="vertical" className="h-6 mx-1" />

                {/* Modes Group */}
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

                {/* Creation Group */}
                <div className="flex items-center gap-1">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent" onClick={() => onAddNode("Text")}>
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
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent" onClick={() => onAddNode("Prompt")}>
                                <Terminal className="w-4 h-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">AI Prompt</TooltipContent>
                    </Tooltip>
                </div>
                
                <div className="flex-1" />

                {/* View & System Group */}
                <div className="flex items-center gap-3">
                    {/* Sync Status Indicator */}
                    <div className="flex items-center justify-end w-24 mr-2 select-none pointer-events-none">
                        {syncStatus === 'saving' ? (
                            <div className="flex items-center text-xs text-primary animate-pulse font-medium">
                                <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                                Saving...
                            </div>
                        ) : (
                            <div className="flex items-center text-xs text-muted-foreground/60 transition-all duration-500">
                                <Check className="w-3.5 h-3.5 mr-1.5 text-green-500/80" />
                                Saved
                            </div>
                        )}
                    </div>

                    <div className="h-4 w-px bg-border/50 mx-1" />

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