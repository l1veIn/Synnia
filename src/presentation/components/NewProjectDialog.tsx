import { useState, useEffect } from "react";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/presentation/components/ui/dialog";
import { Label } from "@/presentation/components/ui/label";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";
import { useTranslation } from "react-i18next";

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (path: string) => void;
}

export function NewProjectDialog({ open: isOpen, onOpenChange, onCreated }: NewProjectDialogProps) {
  const { t } = useTranslation('common');
  const [name, setName] = useState("");
  const [parentPath, setParentPath] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Load default path when dialog opens
  useEffect(() => {
    if (isOpen) {
      apiClient.invoke<string>("get_default_projects_path")
        .then((path) => {
          if (path) setParentPath(path);
        })
        .catch(console.error);
    }
  }, [isOpen]);

  const handleChangePath = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('dialogs.newProject.changeLocation'),
        defaultPath: parentPath
      });

      if (selected && typeof selected === 'string') {
        setParentPath(selected);
      }
    } catch (e) {
      console.error("Failed to open dialog (likely browser mode):", e);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error(t('dialogs.newProject.nameRequired'));
      return;
    }
    if (!parentPath) {
      toast.error(t('dialogs.newProject.locationRequired'));
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiClient.invoke<string>("create_project", {
        name: name.trim(),
        parentPath
      });

      toast.success(t('dialogs.newProject.created'));
      onCreated(res || "");
      onOpenChange(false);
    } catch (e) {
      console.error("Create Project Error:", e);
      const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e);
      toast.error(`${t('dialogs.newProject.createFailed')}: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('dialogs.newProject.title')}</DialogTitle>
          <DialogDescription>
            {t('dialogs.newProject.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">{t('dialogs.newProject.projectName')}</Label>
            <Input
              id="name"
              placeholder={t('dialogs.newProject.placeholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label>{t('dialogs.newProject.location')}</Label>
            <div className="flex gap-2 w-full min-w-0">
              <div className="flex-1 px-3 py-2 text-sm border rounded-md bg-muted text-muted-foreground truncate font-mono min-w-0">
                {parentPath || t('dialogs.newProject.loading')}
              </div>
              <Button variant="outline" size="icon" onClick={handleChangePath} title={t('dialogs.newProject.changeLocation')} className="shrink-0">
                <FolderOpen className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {t('dialogs.newProject.projectPath')} <br />
              <span className="font-mono text-foreground/80">{parentPath || "."}{parentPath?.endsWith('/') || parentPath?.endsWith('\\') ? '' : '/'}{name || "..."}</span>
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={isLoading} className="w-full">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('dialogs.newProject.createProject')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}