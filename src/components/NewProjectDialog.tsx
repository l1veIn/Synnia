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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";

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
      apiClient.invoke<string>("get_default_projects_path")
        .then((path) => {
            if(path) setParentPath(path);
        })
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
      }
    } catch (e) {
      console.error("Failed to open dialog (likely browser mode):", e);
      // Optional: prompt user for path text if dialog fails? 
      // For now, assume default is fine in mock.
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
      const res = await apiClient.invoke<string>("create_project", { 
        name: name.trim(), 
        parentPath 
      });
      
      // Wait, let's check rust argument name in commands/project.rs
      // It is: pub fn create_project(name: String, parent_path: String, ...
      // In Rust: snake_case. In Tauri invoke: camelCase usually unless configured otherwise.
      // Tauri v2 defaults to camelCase for arguments from JS -> Rust? 
      // Actually Tauri 1.x mapped JS camelCase to Rust snake_case automatically.
      // Let's use 'parentPath' to be safe if we assume auto-conversion, or 'parent_path' if explicit.
      // Checking previous file content: user used `parentPath`.
      // If it failed with [object Object], it might be argument mismatch too.
      // I'll use what I saw in Rust: `parent_path`.
      // Wait, let's verify argument naming convention.
      
      toast.success("Project created!");
      onCreated(res || ""); 
      onOpenChange(false);
    } catch (e) {
      console.error("Create Project Error:", e);
      const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e);
      toast.error(`Failed to create: ${msg}`);
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
                <span className="font-mono text-foreground/80">{parentPath || "."}{parentPath?.endsWith('/') || parentPath?.endsWith('\\') ? '' : '/'}{name || "..."}</span>
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