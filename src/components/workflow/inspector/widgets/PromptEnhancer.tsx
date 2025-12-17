import { useState, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Wand2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { callLLM } from '@/lib/services/ai/llm';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface PromptEnhancerProps {
    value?: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    placeholder?: string;
    enhancePrompt?: string; // Custom system prompt for enhancement
}

const DEFAULT_ENHANCE_PROMPT = `You are an expert prompt engineer for AI image and video generation.
Your task is to enhance the user's prompt to be more detailed, evocative, and effective for AI generation.

Rules:
- Keep the core concept and intent of the original prompt
- Add descriptive details: lighting, style, mood, camera angle, quality keywords
- Use natural, flowing language
- Output ONLY the enhanced prompt, no explanations or meta-commentary
- Keep it concise but rich (ideally under 200 words)`;

export function PromptEnhancer({
    value,
    onChange,
    disabled,
    placeholder,
    enhancePrompt = DEFAULT_ENHANCE_PROMPT
}: PromptEnhancerProps) {
    const [isEnhancing, setIsEnhancing] = useState(false);

    const handleEnhance = useCallback(async () => {
        if (!value?.trim() || isEnhancing) return;

        setIsEnhancing(true);
        try {
            const response = await callLLM({
                systemPrompt: enhancePrompt,
                userPrompt: `Enhance this prompt:\n\n${value}`,
                temperature: 0.7,
                maxTokens: 500,
            });

            if (response.success && response.text) {
                onChange(response.text.trim());
            }
        } catch (error) {
            console.error('[PromptEnhancer] Enhancement failed:', error);
        } finally {
            setIsEnhancing(false);
        }
    }, [value, isEnhancing, enhancePrompt, onChange]);

    return (
        <div className="relative">
            <Textarea
                className="text-xs min-h-[100px] pr-10 resize-none"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder || "Describe your vision..."}
                disabled={disabled || isEnhancing}
            />
            <TooltipProvider>
                <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "absolute bottom-2 right-2 h-7 w-7",
                                "hover:bg-primary/10 hover:text-primary",
                                "transition-all duration-200",
                                isEnhancing && "animate-pulse"
                            )}
                            disabled={disabled || isEnhancing || !value?.trim()}
                            onClick={handleEnhance}
                        >
                            {isEnhancing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Wand2 className="h-4 w-4" />
                            )}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-xs">
                        <p>Enhance with AI ✨</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    );
}
