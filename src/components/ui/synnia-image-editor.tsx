import React, { useState, useRef, useEffect } from 'react'
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
    RotateCw,
    Crop as CropIcon,
    Eraser,
    Check,
    X,
    FileType,
    Sparkles,
    RotateCcw,
    Minimize
} from 'lucide-react'
import { canvasPreview, getRotatedImage, createImage } from '@core/utils/canvas'
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { removeBackground } from "@imgly/background-removal"
import { ImageExportDialog } from './image-export-dialog'

interface SynniaImageEditorProps {
    open: boolean
    src: string
    onOpenChange: (open: boolean) => void
    onSave: (blob: Blob) => void
}

type ToolType = 'crop' | 'rotate' | 'bg-remove' | 'compress' | null;

// Helper to center crop
function centerAspectCrop(
    mediaWidth: number,
    mediaHeight: number,
    aspect: number,
) {
    return centerCrop(
        makeAspectCrop(
            {
                unit: '%',
                width: 90,
            },
            aspect,
            mediaWidth,
            mediaHeight,
        ),
        mediaWidth,
        mediaHeight,
    )
}

export function SynniaImageEditor({ open, src, onOpenChange, onSave }: SynniaImageEditorProps) {
    // Core Image State
    const [currentSrc, setCurrentSrc] = useState(src);
    const imgRef = useRef<HTMLImageElement>(null)

    // Crop State
    const [crop, setCrop] = useState<Crop>()
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>()

    // Rotate State (Visual only until applied)
    const [rotation, setRotation] = useState(0)

    // Compress State
    const [quality, setQuality] = useState(90); // 0-100
    const [scale, setScale] = useState(100); // % of original size

    // Export Dialog State
    const [showExportDialog, setShowExportDialog] = useState(false);

    // UI State
    const [activeTool, setActiveTool] = useState<ToolType>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [processingStatus, setProcessingStatus] = useState('');

    // Snapshot for Cancel
    const snapshotRef = useRef<{ src: string, rotation: number, quality: number, scale: number } | null>(null);

    useEffect(() => {
        if (open) {
            setCurrentSrc(src);
            setRotation(0);
            setCrop(undefined);
            setCompletedCrop(undefined);
            setActiveTool(null);
            setIsProcessing(false);
            setProcessingStatus('');
            setQuality(90); // Reset
            setScale(100);  // Reset
            setShowExportDialog(false);
        }
    }, [open, src]);

    // When image loads, initialize crop if in crop mode
    const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        if (activeTool === 'crop') {
            const { width, height } = e.currentTarget
            setCrop(centerAspectCrop(width, height, 16 / 9))
        }
    }

    const handleToolSelect = async (tool: ToolType | 'export') => {
        if (tool === 'export') {
            setShowExportDialog(true);
            return;
        }

        if (tool === activeTool) return;

        // Before switching, handle transition
        if (tool) {
            snapshotRef.current = { src: currentSrc, rotation, quality, scale }; // Store current states
        }

        // Special setup for tools
        if (tool === 'crop') {
            setCrop(undefined); // Reset crop to encourage fresh start or center
        }

        setActiveTool(tool);
    };

    const applyRotate = async () => {
        if (rotation === 0) {
            setActiveTool(null);
            return;
        }

        setIsProcessing(true);
        setProcessingStatus('Applying Rotation...');
        try {
            const newSrc = await getRotatedImage(currentSrc, rotation);
            setCurrentSrc(newSrc);
            setRotation(0); // Reset visual rotation since it's baked in
            setActiveTool(null);
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    };

    const applyCrop = async () => {
        if (!completedCrop || !imgRef.current) {
            setActiveTool(null);
            return;
        }

        setIsProcessing(true);
        setProcessingStatus('Cropping...');
        try {
            const canvas = document.createElement('canvas');
            await canvasPreview(imgRef.current, canvas, completedCrop, 1, 0); // Rotation is 0 because we baked it
            const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
            if (blob) {
                const newUrl = URL.createObjectURL(blob);
                setCurrentSrc(newUrl);
                setCrop(undefined);
                setActiveTool(null);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    };

    const applyCompressionAndResize = async () => {
        setIsProcessing(true);
        setProcessingStatus('Applying Compression & Resize...');
        try {
            const image = await createImage(currentSrc);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) throw new Error('Could not get canvas context');

            const newWidth = image.naturalWidth * (scale / 100);
            const newHeight = image.naturalHeight * (scale / 100);

            canvas.width = newWidth;
            canvas.height = newHeight;

            ctx.drawImage(image, 0, 0, newWidth, newHeight);

            const blob = await new Promise<Blob | null>(resolve =>
                canvas.toBlob(resolve, 'image/png', quality / 100)
            );

            if (blob) {
                const newUrl = URL.createObjectURL(blob);
                setCurrentSrc(newUrl);
                setQuality(90); // Reset
                setScale(100);  // Reset
                setActiveTool(null);
            }

        } catch (e) {
            console.error(e);
            setProcessingStatus('Failed to compress/resize');
        } finally {
            setIsProcessing(false);
        }
    };


    const applyTool = () => {
        setActiveTool(null);
    };

    const cancelTool = () => {
        if (snapshotRef.current) {
            setCurrentSrc(snapshotRef.current.src);
            setRotation(snapshotRef.current.rotation);
            setQuality(snapshotRef.current.quality);
            setScale(snapshotRef.current.scale);
        }
        setCrop(undefined);
        setActiveTool(null);
    };

    const handleBgRemoval = async () => {
        setIsProcessing(true);
        setProcessingStatus('Loading AI Model...');
        try {
            setProcessingStatus('Removing Background...');
            const blob = await removeBackground(currentSrc); // Use current baked source
            const newUrl = URL.createObjectURL(blob);
            setCurrentSrc(newUrl);
            setActiveTool(null);
        } catch (err) {
            console.error("BG Removal Failed", err);
            setProcessingStatus('Failed');
        } finally {
            setIsProcessing(false);
            setProcessingStatus('');
        }
    };

    const handleFinalSave = async () => {
        setIsProcessing(true);
        try {
            // Just save currentSrc as Blob
            // Check if it's a base64 or blob url
            const blob = await fetch(currentSrc).then(r => r.blob());
            onSave(blob);
            onOpenChange(false);
        } catch (e) {
            console.error("Save failed", e);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-background/95 backdrop-blur-xl border-border/50 shadow-2xl">
                <DialogHeader className="px-4 py-3 border-b flex-shrink-0 flex-row items-center justify-between space-y-0 bg-muted/20">
                    <div className="flex items-center gap-2">
                        <DialogTitle className="text-sm font-medium">Image Editor</DialogTitle>
                        {activeTool && (
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full capitalize">
                                {activeTool === 'bg-remove' ? 'Remove BG' : activeTool} Mode
                            </span>
                        )}
                    </div>
                </DialogHeader>
                <DialogDescription className="sr-only">Editor</DialogDescription>

                {/* Canvas */}
                <div className="relative flex-1 w-full bg-[url('/transparent-grid.svg')] bg-repeat bg-center overflow-auto flex items-center justify-center p-8 select-none">
                    {/* Background Grid */}
                    <div className="absolute inset-0 opacity-20 pointer-events-none"
                        style={{
                            backgroundImage: `linear-gradient(45deg, #808080 25%, transparent 25%), linear-gradient(-45deg, #808080 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #808080 75%), linear-gradient(-45deg, transparent 75%, #808080 75%)`,
                            backgroundSize: `20px 20px`
                        }}
                    />

                    {activeTool === 'crop' ? (
                        <ReactCrop
                            crop={crop}
                            onChange={(_, percentCrop) => setCrop(percentCrop)}
                            onComplete={(c) => setCompletedCrop(c)}
                            className="max-h-full max-w-full shadow-lg"
                        >
                            <img
                                ref={imgRef}
                                alt="Crop target"
                                src={currentSrc}
                                crossOrigin="anonymous"
                                onLoad={onImageLoad}
                                // Do not apply rotation here, it messes up react-image-crop coordinates.
                                // Rotation will be applied in getCroppedImg upon final Save/Apply.
                                style={{ maxHeight: '70vh', objectFit: 'contain' }}
                            />
                        </ReactCrop>
                    ) : (
                        <img
                            ref={imgRef} // Also use imgRef here for `naturalWidth/Height` access in compress
                            src={currentSrc}
                            alt="Preview"
                            crossOrigin="anonymous"
                            style={{
                                transform: `rotate(${rotation}deg)`,
                                maxHeight: '70vh',
                                maxWidth: '100%',
                                objectFit: 'contain',
                                transition: 'transform 0.2s ease-out'
                            }}
                            className="shadow-lg"
                        />
                    )}

                    {isProcessing && (
                        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm animate-in fade-in">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
                            <span className="text-sm font-medium">{processingStatus || 'Processing...'}</span>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="flex flex-col border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    {/* Tool Specific Controls */}
                    {activeTool === 'rotate' && (
                        <div className="h-14 flex items-center justify-center gap-6 border-b px-4 animate-in slide-in-from-bottom-2 fade-in">
                            <span className="text-xs font-medium w-12 text-right">{rotation}°</span>
                            <Slider
                                value={[rotation]}
                                min={0}
                                max={360}
                                step={90} // 90 degree steps usually better for basic rotation
                                onValueChange={(v) => setRotation(v[0])}
                                className="w-64"
                            />
                            <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => setRotation(r => (r - 90 + 360) % 360)}>
                                    <RotateCcw className="h-4 w-4 -scale-x-100" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setRotation(r => (r + 90) % 360)}>
                                    <RotateCw className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {activeTool === 'bg-remove' && (
                        <div className="h-14 flex items-center justify-center gap-6 border-b px-4 animate-in slide-in-from-bottom-2 fade-in">
                            <span className="text-xs text-muted-foreground">Remove background using AI?</span>
                            <Button size="sm" onClick={handleBgRemoval} className="gap-2" disabled={isProcessing}>
                                <Sparkles className="w-3.5 h-3.5" />
                                Start Removal
                            </Button>
                        </div>
                    )}

                    {activeTool === 'crop' && (
                        <div className="h-14 flex items-center justify-center gap-6 border-b px-4 animate-in slide-in-from-bottom-2 fade-in">
                            <span className="text-xs text-muted-foreground">Adjust the frame to crop</span>
                            <Button variant="ghost" size="sm" onClick={() => imgRef.current && setCrop(centerAspectCrop(imgRef.current.naturalWidth, imgRef.current.naturalHeight, 1))}>
                                1:1
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => imgRef.current && setCrop(centerAspectCrop(imgRef.current.naturalWidth, imgRef.current.naturalHeight, 16 / 9))}>
                                16:9
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setCrop(undefined)}>
                                Free
                            </Button>
                        </div>
                    )}

                    {activeTool === 'compress' && (
                        <div className="h-14 flex items-center justify-center gap-6 border-b px-4 animate-in slide-in-from-bottom-2 fade-in">
                            <span className="text-xs font-medium w-12 text-right">Quality: {quality}%</span>
                            <Slider
                                value={[quality]}
                                min={1}
                                max={100}
                                step={1}
                                onValueChange={(v) => setQuality(v[0])}
                                className="w-48"
                            />
                            <span className="text-xs font-medium w-12 text-right">Scale: {scale}%</span>
                            <Slider
                                value={[scale]}
                                min={10}
                                max={200}
                                step={1}
                                onValueChange={(v) => setScale(v[0])}
                                className="w-48"
                            />
                        </div>
                    )}

                    {/* Main Toolbar */}
                    <DialogFooter className="p-2 sm:justify-between items-center gap-2">
                        {activeTool ? (
                            <div className="flex w-full items-center justify-between px-2">
                                <Button variant="ghost" size="sm" onClick={cancelTool} disabled={isProcessing}>
                                    <X className="mr-2 h-4 w-4" /> Cancel
                                </Button>
                                <span className="text-sm font-medium capitalize">{activeTool === 'bg-remove' ? 'Magic Remove' : activeTool}</span>

                                {/* Some tools like bg-remove have their own confirm button inside Level 2 */}
                                {activeTool !== 'bg-remove' && (
                                    <Button size="sm"
                                        onClick={
                                            activeTool === 'rotate' ? applyRotate :
                                                activeTool === 'crop' ? applyCrop :
                                                    activeTool === 'compress' ? applyCompressionAndResize :
                                                        applyTool // Fallback for other tools
                                        }
                                        disabled={isProcessing}
                                    >
                                        <Check className="mr-2 h-4 w-4" /> Apply
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar mask-fade-right">
                                    <ToggleGroup type="single" value={activeTool || ""} onValueChange={(v) => handleToolSelect(v as ToolType)}>
                                        <ToggleGroupItem value="crop" aria-label="Crop">
                                            <CropIcon className="h-4 w-4 mr-2" />
                                            <span className="text-xs">Crop</span>
                                        </ToggleGroupItem>
                                        <ToggleGroupItem value="rotate" aria-label="Rotate">
                                            <RotateCw className="h-4 w-4 mr-2" />
                                            <span className="text-xs">Rotate</span>
                                        </ToggleGroupItem>
                                        <ToggleGroupItem value="bg-remove" aria-label="Remove BG" disabled={isProcessing}>
                                            <Eraser className="h-4 w-4 mr-2" />
                                            <span className="text-xs">Magic Remove</span>
                                        </ToggleGroupItem>
                                        <ToggleGroupItem value="compress" aria-label="Compress">
                                            <Minimize className="h-4 w-4 mr-2" />
                                            <span className="text-xs">Compress</span>
                                        </ToggleGroupItem>
                                        <ToggleGroupItem value="export" aria-label="Export">
                                            <FileType className="h-4 w-4 mr-2" />
                                            <span className="text-xs">Convert & Export</span>
                                        </ToggleGroupItem>
                                    </ToggleGroup>
                                </div>

                                <div className="flex items-center gap-2 ml-auto pl-4 border-l">
                                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isProcessing}>
                                        Close
                                    </Button>
                                    <Button onClick={handleFinalSave} disabled={isProcessing}>
                                        {isProcessing ? 'Processing...' : 'Save Image'}
                                    </Button>
                                </div>
                            </>
                        )}
                    </DialogFooter>
                </div>
            </DialogContent>

            {/* Nested Export Dialog */}
            <ImageExportDialog
                open={showExportDialog}
                onOpenChange={setShowExportDialog}
                src={currentSrc}
            />
        </Dialog>
    )
}
