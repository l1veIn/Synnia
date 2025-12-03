import { FolderOpen, Folder, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CollectionNodeViewProps {
    nodeId: string;
    isCollapsed: boolean;
    isReadyToDrop: boolean;
    isHovering: boolean;
    childCount: number;
    onToggle: (e: React.MouseEvent) => void;
}

export function CollectionNodeView({ 
    nodeId, 
    isCollapsed, 
    isReadyToDrop, 
    isHovering,
    childCount,
    onToggle
}: CollectionNodeViewProps) {
    
    return (
        <div 
            className="w-full h-full relative group"
            onDoubleClick={onToggle}
        >
            {/* Background Grid/Pattern for Opened State */}
            {!isCollapsed && (
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                    style={{ 
                        backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', 
                        backgroundSize: '20px 20px' 
                    }} 
                />
            )}

            <AnimatePresence mode="wait">
                {isCollapsed ? (
                    // --- Collapsed State (Stack Preview) ---
                    <motion.div 
                        key="collapsed"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex flex-col items-center justify-center h-full gap-2 cursor-pointer relative"
                    >
                        {/* Progress Ring Overlay */}
                        {isHovering && !isReadyToDrop && (
                            <motion.svg
                                className="absolute w-24 h-24 pointer-events-none z-10"
                                viewBox="0 0 100 100"
                            >
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="45"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    className="text-muted/20"
                                />
                                <motion.circle
                                    cx="50"
                                    cy="50"
                                    r="45"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    className="text-green-500"
                                    strokeLinecap="round"
                                    strokeDasharray="283" // 2 * pi * 45
                                    initial={{ strokeDashoffset: 283 }}
                                    animate={{ strokeDashoffset: 0 }}
                                    transition={{ duration: 0.5, ease: "linear" }}
                                />
                            </motion.svg>
                        )}

                        <div className="relative z-0">
                            <Folder className={cn(
                                "w-16 h-16 transition-all duration-300",
                                isReadyToDrop ? "text-green-500 scale-110 drop-shadow-lg" : "text-primary/80"
                            )} />
                            
                            {/* Badge for Child Count */}
                            {childCount > 0 && (
                                <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md">
                                    {childCount}
                                </div>
                            )}
                        </div>

                        <div className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                            <Layers className="w-3 h-3" />
                            {childCount} items
                        </div>
                        
                        {/* Text Hint */}
                        {(isHovering || isReadyToDrop) && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={cn(
                                    "absolute bottom-2 text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors",
                                    isReadyToDrop ? "text-green-600 bg-green-100" : "text-primary bg-background/80"
                                )}
                            >
                                {isReadyToDrop ? "Release" : "Hold..."}
                            </motion.div>
                        )}
                    </motion.div>
                ) : (
                    // --- Expanded State (Container) ---
                    <motion.div 
                        key="expanded"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 flex flex-col"
                    >
                         {/* Empty State Hint if no children */}
                        {childCount === 0 && !isReadyToDrop && (
                            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/30 select-none pointer-events-none">
                                <FolderOpen className="w-12 h-12 mb-2" />
                                <p className="text-xs">Empty Collection</p>
                                <p className="text-[10px]">Drag items here</p>
                            </div>
                        )}

                        {/* Drop Hint Overlay */}
                        {isReadyToDrop && (
                            <div className="absolute inset-0 bg-green-500/10 border-2 border-green-500/50 border-dashed rounded-lg m-2 flex items-center justify-center z-50">
                                <span className="text-sm font-bold text-green-600 bg-background/80 px-3 py-1 rounded shadow-sm">
                                    Add to Collection
                                </span>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Hover Trigger for Drag Logic is handled by parent dropTargetState, 
                but visual feedback is rendered here. */}
        </div>
    );
}