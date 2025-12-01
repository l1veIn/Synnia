import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://generativelanguage.googleapis.com");
  const [modelName, setModelName] = useState("gemini-1.5-flash");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      const fetchSettings = async () => {
        try {
          const key = await invoke<string>("get_api_key");
          setApiKey(key);
          
          const url = await invoke<string>("get_base_url").catch(() => "");
          if (url) setBaseUrl(url);

          const model = await invoke<string>("get_model_name").catch(() => "");
          if (model) setModelName(model);
        } catch (e) {
          console.log("Error fetching settings", e);
        }
      };
      fetchSettings();
    }
  }, [open]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await invoke("save_settings", { key: apiKey, baseUrl: baseUrl, modelName: modelName });
      toast.success("Settings saved");
      setOpen(false);
    } catch (e) {
      toast.error(`Failed to save: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure global AI preferences.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="apiKey" className="text-right">
              Gemini Key
            </Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="col-span-3"
              placeholder="AIzSy..."
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="baseUrl" className="text-right">
              Base URL
            </Label>
            <Input
              id="baseUrl"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="col-span-3"
              placeholder="https://generativelanguage.googleapis.com"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="modelName" className="text-right">
              Model
            </Label>
            <Input
              id="modelName"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="col-span-3"
              placeholder="gemini-1.5-flash"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSave} disabled={loading}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
