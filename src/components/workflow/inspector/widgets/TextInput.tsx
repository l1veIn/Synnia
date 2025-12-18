import { Input } from '@/components/ui/input';
import { Link } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TextInputProps {
    value?: string | number;
    onChange: (value: string | number) => void;
    disabled?: boolean;
    placeholder?: string;
    isConnected?: boolean;
    connectedLabel?: string;
    type?: 'text' | 'number' | 'password' | 'email';
    min?: number;
    max?: number;
    step?: number;
    className?: string;
}

export function TextInput({
    value,
    onChange,
    disabled,
    placeholder,
    isConnected,
    connectedLabel = 'Connected',
    type = 'text',
    min,
    max,
    step,
    className
}: TextInputProps) {
    // When connected, show connected state
    if (isConnected) {
        return (
            <div className={cn(
                "flex items-center gap-2 h-8 px-3 rounded-md border border-blue-500/30 bg-blue-500/5",
                className
            )}>
                <Link className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-xs text-blue-500 font-medium">{connectedLabel}</span>
            </div>
        );
    }

    return (
        <Input
            type={type}
            className={cn("h-8 text-xs", className)}
            value={value ?? ''}
            onChange={(e) => {
                if (type === 'number') {
                    onChange(Number(e.target.value));
                } else {
                    onChange(e.target.value);
                }
            }}
            placeholder={placeholder}
            disabled={disabled}
            min={min}
            max={max}
            step={step}
        />
    );
}
