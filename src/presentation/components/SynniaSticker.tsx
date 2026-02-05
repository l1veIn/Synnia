import { cn } from "@/lib/utils";

interface SynniaStickerProps {
    index?: number; // 0-8
    className?: string;
}

export function SynniaSticker({ index = 8, className }: SynniaStickerProps) {
    // 3x3 Grid Logic
    // Index 0-8
    // Row = Math.floor(index / 3)
    // Col = index % 3
    
    const col = index % 3;
    const row = Math.floor(index / 3);

    // Calculate position percentages
    // 3 cols means positions are 0%, 50%, 100%
    const xPos = col * 50; 
    const yPos = row * 50;

    return (
        <div 
            className={cn("bg-no-repeat bg-cover aspect-square", className)}
            style={{
                backgroundImage: 'url("/assets/sticker.png")', // Fallback to sticker.png as requested
                backgroundSize: '300% 300%',
                backgroundPosition: `${xPos}% ${yPos}%`
            }}
            role="img"
            aria-label={`Synnia Sticker ${index}`}
        />
    );
}
