import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    ChevronLeft,
    Save,
    FilePlus,
    FolderPlus,
    RefreshCw,
    Play
} from "lucide-react";
import { SynniaIcon } from "@/components/SynniaIcon";
import { apiClient } from '@/lib/apiClient';
import { FileNode } from '@/types/recipe';
import { toast } from "sonner";
import { FileTree } from "@/components/ui/file-tree";
import Editor from '@monaco-editor/react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

// Placeholder for Preview Component (to be implemented later)
const RecipePreview = ({ manifestContent }: { manifestContent: string }) => {
    return (
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center bg-card/10">
            <Play className="w-12 h-12 mb-4 opacity-20" />
            <h3 className="text-lg font-medium mb-2">Live Preview</h3>
            <p className="text-sm opacity-60">
                Preview update logic will be implemented here. <br />
                Currently showing placeholder.
            </p>
        </div>
    );
};

export default function RecipeEditorPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const recipePath = searchParams.get('path'); // The relative path to the recipe (e.g. "example/my-recipe")

    // Data State
    const [fileTree, setFileTree] = useState<FileNode[]>([]);
    const [currentFile, setCurrentFile] = useState<string | null>(null); // Relative path inside recipe
    const [fileContent, setFileContent] = useState("");
    const [manifestContent, setManifestContent] = useState(""); // Cache for preview
    const [isDirty, setIsDirty] = useState(false);

    // UI State
    const [loading, setLoading] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newFileName, setNewFileName] = useState("");

    // Load File Tree
    const loadTree = useCallback(async () => {
        if (!recipePath) return;
        try {
            const nodes = await apiClient.getRecipeFileTree(recipePath);
            setFileTree(nodes);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load file tree");
        }
    }, [recipePath]);

    useEffect(() => {
        if (!recipePath) {
            toast.error("No recipe path specified");
            navigate('/recipes');
            return;
        }
        loadTree();
        // Default select manifest.yaml
        handleFileSelect({ name: 'manifest.yaml', path: 'manifest.yaml', is_dir: false });
    }, [recipePath, loadTree, navigate]);

    // File Operations
    const handleFileSelect = async (node: FileNode) => {
        if (node.is_dir) return; // Expand/collapse handled by Tree component

        if (isDirty && currentFile) {
            if (!confirm("You have unsaved changes. Discard them?")) return;
        }

        try {
            if (!recipePath) return;
            const content = await apiClient.readRecipeFile(recipePath, node.path);
            setCurrentFile(node.path);
            setFileContent(content);
            setIsDirty(false);

            if (node.path === 'manifest.yaml') {
                setManifestContent(content);
            }
        } catch (error) {
            console.error(error);
            toast.error(`Failed to read ${node.name}`);
        }
    };

    const handleSave = async () => {
        if (!recipePath || !currentFile) return;
        try {
            await apiClient.writeRecipeFile(recipePath, currentFile, fileContent);
            setIsDirty(false);
            toast.success("Saved");

            // Update preview if manifest saved
            if (currentFile === 'manifest.yaml') {
                setManifestContent(fileContent);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to save");
        }
    };

    const handleCreateFile = async () => {
        if (!recipePath || !newFileName) return;
        try {
            await apiClient.createRecipeFile(recipePath, newFileName);
            toast.success("File created");
            setIsCreateOpen(false);
            setNewFileName("");
            loadTree();
        } catch (error) {
            console.error(error);
            toast.error("Failed to create file");
        }
    };

    const handleDeleteFile = async (node: FileNode) => {
        if (!recipePath) return;
        if (!confirm(`Delete ${node.name}?`)) return;
        try {
            await apiClient.deleteRecipeFile(recipePath, node.path);
            toast.success("File deleted");

            if (currentFile === node.path) {
                setCurrentFile(null);
                setFileContent("");
            }
            loadTree();
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete");
        }
    };

    return (
        <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
            {/* Header */}
            <div className="h-12 border-b flex items-center justify-between px-4 bg-background/50 backdrop-blur z-20">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/recipes')}>
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Back
                    </Button>
                    <span className="font-mono text-sm opacity-50">
                        {recipePath} / <span className="text-foreground font-bold">{currentFile || "No file selected"}</span>
                    </span>
                    {isDirty && <span className="text-xs text-yellow-500 font-medium">● Unsaved</span>}
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleSave}
                        disabled={!isDirty || !currentFile}
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Save
                    </Button>
                </div>
            </div>

            {/* Main Workspace (3 Pane) */}
            <div className="flex-1 overflow-hidden flex">

                {/* Left: Fixed File Tree */}
                <div className="w-64 flex-shrink-0 bg-muted/10 border-r flex flex-col">
                    <div className="p-2 border-b flex justify-between items-center h-10">
                        <span className="text-xs font-bold uppercase tracking-wider opacity-50 ml-2">Files</span>
                        <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsCreateOpen(true)}>
                                <FilePlus className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={loadTree}>
                                <RefreshCw className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        <FileTree
                            nodes={fileTree}
                            selectedPath={currentFile}
                            onSelect={handleFileSelect}
                            onDelete={handleDeleteFile}
                        />
                    </div>
                </div>

                {/* Right: Editor & Preview */}
                <div className="flex-1 min-w-0">
                    <ResizablePanelGroup orientation="horizontal">
                        {/* Center: Editor */}
                        <ResizablePanel defaultSize={65} minSize={30}>
                            {currentFile ? (
                                <Editor
                                    height="100%"
                                    path={currentFile} // Helps Monaco determine language
                                    defaultLanguage="yaml"
                                    value={fileContent}
                                    onChange={(val: string | undefined) => {
                                        setFileContent(val || "");
                                        setIsDirty(true);
                                    }}
                                    theme="vs-dark"
                                    options={{
                                        minimap: { enabled: false },
                                        fontSize: 13,
                                        fontFamily: 'JetBrains Mono, monospace',
                                        scrollBeyondLastLine: false,
                                    }}
                                />
                            ) : (
                                <div className="h-full flex items-center justify-center text-muted-foreground bg-background/50">
                                    <p>Select a file to edit</p>
                                </div>
                            )}
                        </ResizablePanel>

                        <ResizableHandle />

                        {/* Right: Preview */}
                        <ResizablePanel defaultSize={35} minSize={20} className="bg-background border-l">
                            <RecipePreview manifestContent={manifestContent} />
                        </ResizablePanel>
                    </ResizablePanelGroup>
                </div>
            </div>

            {/* Create File Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New File</DialogTitle>
                        <DialogDescription>
                            Enter relative path (e.g. `prompts/user.md`). Directories will be created automatically.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label>File Path</Label>
                        <Input
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            placeholder="prompts/new-prompt.md"
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateFile}>Create</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
