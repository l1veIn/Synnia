import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useSettings, isProviderConfigured } from "@/lib/settings";
import { getAllLLMModels } from "@/lib/models";

export function GeneralSettingsPage() {
    const { settings, loading, setDefaultModel } = useSettings();

    const availableLLMOptions = useMemo(() => {
        const allModels = getAllLLMModels();
        return allModels.filter(m => {
            const provider = m.provider || (m.supportedProviders || [])[0];
            return provider ? isProviderConfigured(settings, provider) : false;
        });
    }, [settings]);

    const handleDefaultLLMChange = async (model: string) => {
        try {
            await setDefaultModel('llm-chat', model);
            toast.success("Default LLM updated");
        } catch (e: any) {
            toast.error(`Failed to save: ${e.message}`);
        }
    };

    return (
        <div className="h-full flex flex-col p-8 space-y-6 overflow-y-auto">
            <div>
                <h2 className="text-lg font-semibold tracking-tight">General</h2>
                <p className="text-sm text-muted-foreground">Configure global preferences for Synnia.</p>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>Default LLM</Label>
                    <p className="text-[12px] text-muted-foreground">
                        Used for utility functions like Prompt Enhancer and Autofill.
                    </p>
                    <Select
                        value={settings?.defaultModels?.['llm-chat'] || 'gpt-4o-mini'}
                        onValueChange={handleDefaultLLMChange}
                        disabled={loading}
                    >
                        <SelectTrigger className="w-full max-w-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {availableLLMOptions.length > 0 ? (
                                availableLLMOptions.map((m) => (
                                    <SelectItem key={m.id} value={m.id}>
                                        {m.name} ({m.provider})
                                    </SelectItem>
                                ))
                            ) : (
                                <SelectItem value="gpt-4o-mini" disabled>
                                    Configure a provider in Models first
                                </SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    );
}
