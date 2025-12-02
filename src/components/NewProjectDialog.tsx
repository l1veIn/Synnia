import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
// DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (path: string) => void;
}

export function NewProjectDialog({ open: isOpen, onOpenChange, onCreated }: NewProjectDialogProps) {
  const [name, setName] = useState("");
  const [parentPath, setParentPath] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Load default path when dialog opens
  useEffect(() => {
    if (isOpen) {
      invoke<string>("get_default_projects_path")
        .then(setParentPath)
        .catch(console.error);
    }
  }, [isOpen]);

  const handleChangePath = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Workspace Folder",
        defaultPath: parentPath
      });
      
      if (selected && typeof selected === 'string') {
        setParentPath(selected);
        // Optionally save this as new default?
        // invoke("set_default_projects_path", { path: selected });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Please enter a project name");
      return;
    }
    if (!parentPath) {
      toast.error("Please select a location");
      return;
    }

    setIsLoading(true);
    try {
      const res = await invoke<string>("create_project", { 
        name: name.trim(), 
        parentPath 
      });
      toast.success("Project created!");
      
      // Extract full path from response or construct it?
      // The command returns "Project initialized at {path}" or similar.
      // Ideally command should return just path.
      // Let's assume backend works and we can just construct path or rely on init to set recent.
      // We need to navigate to it.
      // Re-read create_project: it calls init_project which returns a message.
      // But init_project sets 'current_project_path' in state.
      
      // Actually, create_project calls init_project internally, so project IS loaded.
      // We just need to notify parent to navigate.
      onCreated(res); 
      onOpenChange(false);
    } catch (e) {
      toast.error(`Failed to create: ${e}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Universe</DialogTitle>
          <DialogDescription>
            Start a new creative journey. Your assets will be stored locally.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              placeholder="e.g. Neon Tokyo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label>Location</Label>
            <div className="flex gap-2 w-full min-w-0">
                <div className="flex-1 px-3 py-2 text-sm border rounded-md bg-muted text-muted-foreground truncate font-mono min-w-0">
                    {parentPath || "Loading..."}
                </div>
                <Button variant="outline" size="icon" onClick={handleChangePath} title="Change Location" className="shrink-0">
                    <FolderOpen className="w-4 h-4" />
                </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
                Project will be created at: <br/>
                <span className="font-mono text-foreground/80">{parentPath}\{name || "..."}</span>
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={isLoading} className="w-full">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
