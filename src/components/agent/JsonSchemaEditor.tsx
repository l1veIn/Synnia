import React, { useState, useEffect } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface JsonSchemaEditorProps {
    value: string; // The JSON string
    onChange: (value: string, isValid: boolean) => void;
    label?: string;
}

export const JsonSchemaEditor: React.FC<JsonSchemaEditorProps> = ({ value, onChange, label }) => {
    const [text, setText] = useState(value);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setText(value);
        validate(value);
    }, [value]);

    const validate = (jsonStr: string) => {
        try {
            JSON.parse(jsonStr);
            setError(null);
            return true;
        } catch (e: any) {
            setError(e.message);
            return false;
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newVal = e.target.value;
        setText(newVal);
        const isValid = validate(newVal);
        onChange(newVal, isValid);
    };

    const handleFormat = () => {
        try {
            const obj = JSON.parse(text);
            const formatted = JSON.stringify(obj, null, 2);
            setText(formatted);
            onChange(formatted, true);
            setError(null);
        } catch (e) {
            // ignore format error
        }
    };

    return (
        <div className="flex flex-col h-full space-y-2">
            <div className="flex justify-between items-center">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {label || "JSON Schema"}
                </Label>
                <div className="flex items-center gap-2">
                    {error ? (
                        <span className="text-[10px] text-red-500 flex items-center">
                            <AlertCircle className="w-3 h-3 mr-1" /> Invalid JSON
                        </span>
                    ) : (
                         <span className="text-[10px] text-green-500 flex items-center">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Valid
                        </span>
                    )}
                    <button 
                        onClick={handleFormat}
                        className="text-[10px] px-2 py-0.5 bg-secondary rounded hover:bg-secondary/80 transition-colors"
                        type="button"
                    >
                        Format
                    </button>
                </div>
            </div>
            <Textarea 
                value={text}
                onChange={handleChange}
                className={cn(
                    "font-mono text-xs min-h-[200px] h-full resize-none bg-muted/30 leading-relaxed",
                    error && "border-red-500 focus-visible:ring-red-500"
                )}
                spellCheck={false}
            />
            {error && (
                <div className="text-[10px] text-red-500 truncate font-mono bg-red-500/10 p-1 rounded">
                    {error}
                </div>
            )}
        </div>
    );
};
