import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Cloud, Server, Eye, EyeOff, Check, X } from "lucide-react";
import { ProviderInfo } from "@/lib/settings";
import { cn } from "@/lib/utils";

interface ProviderInputProps {
    provider: ProviderInfo;
    config: { apiKey?: string; baseUrl?: string };
    onChange: (config: { apiKey?: string; baseUrl?: string }) => void;
    disabled?: boolean;
}

export function ProviderInput({
    provider,
    config,
    onChange,
    disabled,
}: ProviderInputProps) {
    const [show, setShow] = useState(false);
    const [localApiKey, setLocalApiKey] = useState(config.apiKey || '');
    const [localBaseUrl, setLocalBaseUrl] = useState(config.baseUrl || provider.defaultBaseUrl || '');

    useEffect(() => {
        setLocalApiKey(config.apiKey || '');
        setLocalBaseUrl(config.baseUrl || provider.defaultBaseUrl || '');
    }, [config, provider.defaultBaseUrl]);

    const handleBlur = () => {
        const newConfig: { apiKey?: string; baseUrl?: string } = {};
        if (localApiKey) newConfig.apiKey = localApiKey;
        if (localBaseUrl) newConfig.baseUrl = localBaseUrl;
        onChange(newConfig);
    };

    const clearInput = () => {
        if (provider.type === 'cloud') {
            setLocalApiKey('');
            onChange({ apiKey: '' }); // Explicitly clear
        } else {
            setLocalBaseUrl('');
            onChange({ baseUrl: '' }); // Explicitly clear
        }
    };

    const isConfigured = provider.type === 'cloud' ? !!localApiKey : !!localBaseUrl;
    const hasValue = provider.type === 'cloud' ? !!localApiKey : !!localBaseUrl;

    return (
        <div className={cn(
            "group flex flex-col gap-3 p-4 border rounded-xl bg-card transition-all",
            isConfigured ? "border-green-500/30 bg-green-500/5" : "hover:border-muted-foreground/30 hover:bg-accent/50"
        )}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "p-2 rounded-lg transition-colors",
                        isConfigured ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
                    )}>
                        {provider.type === 'cloud' ? <Cloud className="w-4 h-4" /> : <Server className="w-4 h-4" />}
                    </div>
                    <div>
                        <div className="font-medium text-sm leading-none flex items-center gap-2">
                            {provider.name}
                            {isConfigured && <Check className="w-3 h-3 text-green-500" />}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{provider.description}</div>
                    </div>
                </div>
            </div>

            <div className="pl-0 sm:pl-11">
                {/* API Key (for cloud providers) */}
                {provider.requiresApiKey && (
                    <div className="relative flex items-center">
                        <Input
                            type={show ? "text" : "password"}
                            value={localApiKey}
                            onChange={(e) => setLocalApiKey(e.target.value)}
                            onBlur={handleBlur}
                            placeholder={provider.placeholder}
                            className="h-9 text-xs font-mono pr-16 bg-background/50 focus:bg-background transition-colors"
                            disabled={disabled}
                        />
                        <div className="absolute right-1 top-1 flex items-center gap-0.5">
                            {hasValue && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive transition-colors"
                                    onClick={clearInput}
                                    title="Clear API Key"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => setShow(!show)}
                                title={show ? "Hide API Key" : "Show API Key"}
                            >
                                {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Base URL (for local providers) */}
                {provider.type === 'local' && (
                    <div className="relative flex items-center">
                        <Input
                            value={localBaseUrl}
                            onChange={(e) => setLocalBaseUrl(e.target.value)}
                            onBlur={handleBlur}
                            placeholder={provider.placeholder}
                            className="h-9 text-xs font-mono pr-8 bg-background/50 focus:bg-background transition-colors"
                            disabled={disabled}
                        />
                        {hasValue && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1 h-7 w-7 text-muted-foreground hover:text-destructive transition-colors"
                                onClick={clearInput}
                            >
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
