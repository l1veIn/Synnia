import { cn } from "@/lib/utils";
import { useState } from "react";

interface SynniaIconProps {
  className?: string;
  interactive?: boolean;
}

export function SynniaIcon({ className, interactive = false }: SynniaIconProps) {
  // Persist selection
  const [index, setIndex] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem("synnia-icon-index");
      return saved ? parseInt(saved, 10) : 0;
    }
    return 0;
  });

  const handleClick = () => {
    if (!interactive) return;
    const next = (index + 1) % 9; 
    setIndex(next);
    localStorage.setItem("synnia-icon-index", next.toString());
  };

  // Sprite Dimensions (Exact pixels)
  const TOTAL_SIZE = 4096;
  const PADDING = 42;
  const GUTTER = 42;
  
  // Calculate icon size
  // 4096 = 2*30 + 3*ICON + 2*30
  // 3*ICON = 4096 - 120 = 3976
  // ICON = 1325.333...
  const ICON_SIZE = (TOTAL_SIZE - 2 * PADDING - 2 * GUTTER) / 3;

  const col = index % 3;
  const row = Math.floor(index / 3);

  const x = PADDING + col * (ICON_SIZE + GUTTER);
  const y = PADDING + row * (ICON_SIZE + GUTTER);

  const upscale = 0.1;
  const upscale_size = ICON_SIZE * upscale;
  return (
    <div
      onClick={handleClick}
      onMouseEnter={handleClick}
      onMouseLeave={handleClick}
      className={cn(
        "relative overflow-hidden bg-muted rounded-full shadow-sm border-2 border-secondary/50 shrink-0 transition-all duration-300", 
        interactive && "cursor-pointer hover:ring-2 hover:ring-primary hover:shadow-primary/20 active:scale-95",
        className
      )}
      title={interactive ? "Click to switch avatar" : "Synnia"}
    >
        <svg 
            viewBox={`${x+upscale_size} ${y+upscale_size} ${ICON_SIZE-upscale_size*2} ${ICON_SIZE-upscale_size*2}`} 
            className="w-full h-full"
            preserveAspectRatio="xMidYMid slice"
        >
            <image 
                href="/assets/App_Icon_Variants_icon-set-variant.png" 
                width={TOTAL_SIZE} 
                height={TOTAL_SIZE} 
            />
        </svg>
    </div>
  );
}
