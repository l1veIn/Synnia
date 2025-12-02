import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Check } from "lucide-react";
import { removeBackground } from "@imgly/background-removal";
import { convertFileSrc } from "@tauri-apps/api/core";

interface RemoveBgDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // nodeId: string; // Removed
  imagePath: string;
  projectPath: string;
  onSave: (blob: Blob) => Promise<void>;
}

export function RemoveBgDialog({ open, onOpenChange, imagePath, projectPath, onSave }: RemoveBgDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load original image
  useEffect(() => {
    if (open && imagePath && projectPath) {
        // Use forward slash for safety
        const fullPath = `${projectPath}/${imagePath}`; 
        const url = convertFileSrc(fullPath);
        setOriginalUrl(url);
        
        // Reset state
        setProcessedUrl(null);
        setProcessedBlob(null);
        setSliderPos(50);
        
        // Auto-start processing
        processImage(url);
    }
  }, [open, imagePath, projectPath]);

  const processImage = async (src: string) => {
      setIsProcessing(true);
      try {
          // 1. Fetch manually to ensure full quality/no-cors-weirdness
          const response = await fetch(src);
          const originalBlob = await response.blob();
          
          const config = {
              debug: true, // Enable debug logs in console
              progress: (_key: string, _current: number, _total: number) => {
                  // console.log(`Downloading ${key}: ${current} of ${total}`);
              },
              // We can't easily switch models without hosting them, 
              // but ensuring raw blob input sometimes helps.
          };

          // 2. Pass Blob directly
          const blob = await removeBackground(originalBlob, config);
          const url = URL.createObjectURL(blob);
          setProcessedBlob(blob);
          setProcessedUrl(url);
      } catch (e) {
          console.error("BG Removal failed:", e);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleSave = async () => {
      if (processedBlob) {
          await onSave(processedBlob);
          onOpenChange(false);
      }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      setSliderPos((x / rect.width) * 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] flex flex-col h-[80vh] p-0 gap-0 overflow-hidden bg-background border-border">
        <DialogHeader className="p-4 border-b border-border">
          <DialogTitle>Magic Background Eraser</DialogTitle>
        </DialogHeader>
        
        <div 
            className="flex-1 relative w-full h-full overflow-hidden select-none flex items-center justify-center bg-muted/10"
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
        >
            {/* Layer 0: Checkerboard Background */}
            <div className="absolute inset-0 pointer-events-none z-0" 
                style={{
                    backgroundImage: 'conic-gradient(#333 90deg, #444 90deg 180deg, #333 180deg 270deg, #444 270deg)',
                    backgroundSize: '20px 20px',
                    opacity: 1
                }} 
            />

            {/* Loading Overlay */}
            {isProcessing && (
                <div className="absolute inset-0 z-50 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center text-muted-foreground gap-3 animate-in fade-in">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm font-medium">Processing Image...</p>
                </div>
            )}

            {/* Content Container - Ensures both images have exact same layout */}
            <div className="relative w-full h-full p-8 flex items-center justify-center">
                
                {/* Layer 1: Processed Image (Bottom) */}
                {processedUrl && (
                    <img 
                        src={processedUrl} 
                        className="max-w-full max-h-full object-contain select-none pointer-events-none drop-shadow-xl" 
                        draggable={false} 
                    />
                )}

                {/* Layer 2: Original Image (Top) - Clipped */}
                <div 
                    className="absolute inset-0 p-8 flex items-center justify-center z-10"
                    style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
                >
                     {originalUrl && (
                        <div className="relative w-full h-full flex items-center justify-center">
                            {/* Semi-transparent overlay for original to distinguish it */}
                            <div className="absolute inset-0 bg-background/10 pointer-events-none" />
                            <img 
                                src={originalUrl} 
                                className="max-w-full max-h-full object-contain select-none pointer-events-none" 
                                draggable={false} 
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Slider Handle Line */}
            <div 
                className="absolute top-0 bottom-0 w-0.5 bg-primary z-20 cursor-ew-resize hover:w-1 transition-all"
                style={{ left: `${sliderPos}%` }}
            >
                 <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-primary rounded-full shadow-lg flex items-center justify-center border-2 border-background transform hover:scale-110 transition-transform">
                     <div className="flex gap-0.5">
                         <div className="w-0.5 h-3 bg-white rounded-full" />
                         <div className="w-0.5 h-3 bg-white rounded-full" />
                     </div>
                 </div>
            </div>

        </div>

        <DialogFooter className="p-4 border-t border-border bg-muted/20 justify-between items-center">
            <div className="text-xs text-muted-foreground font-mono">
                 {processedBlob ? `${(processedBlob.size / 1024).toFixed(1)} KB` : 'Ready'}
            </div>
            <Button onClick={handleSave} disabled={isProcessing || !processedBlob}>
                <Check className="w-4 h-4 mr-2" />
                Apply & Save
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}