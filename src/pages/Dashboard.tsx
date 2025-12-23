import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, FolderOpen, Clock, ChevronRight, Trash2, Github, Pencil } from "lucide-react";
import { open } from '@tauri-apps/plugin-dialog';
import { SynniaIcon } from "@/components/SynniaIcon";
import { SynniaSticker } from "@/components/SynniaSticker";
import { NewProjectDialog } from "@/components/NewProjectDialog";
import { convertFileSrc } from '@tauri-apps/api/core';
import { apiClient } from '@/lib/apiClient'; // Use our wrapper

interface RecentProject {
    name: string;
    path: string;
    last_opened: string;
}

function ProjectCard({ project, onClick, onDelete, onRename }: { project: RecentProject, onClick: () => void, onDelete: () => void, onRename: () => void }) {
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        // Only try to load real file src if NOT in pure mock mode
        // For now, in mock mode, convertFileSrc might fail or return invalid URL
        try {
            const thumbPath = `${project.path}/thumbnail.png`;
            const url = convertFileSrc(thumbPath);
            setImgSrc(url);
        } catch (e) {
            setHasError(true);
        }
    }, [project.path]);

    const stickerIndex = project.name.length % 9;

    return (
        <Card
            className="bg-card border-border hover:bg-accent/50 transition-all cursor-pointer group overflow-hidden relative"
            onClick={onClick}
        >
            {/* Actions Overlay */}
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-20">
                <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7 shadow-md hover:scale-110 bg-background/80 backdrop-blur border border-border"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRename();
                    }}
                >
                    <Pencil className="w-3.5 h-3.5 text-foreground/80" />
                </Button>
                <Button
                    variant="destructive"
                    size="icon"
                    className="h-7 w-7 shadow-md hover:scale-110"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </Button>
            </div>

            <div className="h-32 bg-gradient-to-br from-muted/50 to-transparent p-0 relative overflow-hidden group-hover:scale-105 transition-transform duration-500 flex items-center justify-center">
                {!hasError && imgSrc ? (
                    <img
                        src={imgSrc}
                        alt={project.name}
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                        onError={() => { setHasError(true); }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-secondary/30">
                        <SynniaSticker index={stickerIndex} className="w-40 h-40 opacity-80 grayscale-[0.3] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-500" />
                    </div>
                )}
            </div>
            <CardContent className="p-5">
                <CardTitle className="text-lg mb-1 truncate">{project.name}</CardTitle>
                <p className="text-xs text-muted-foreground truncate font-mono">{project.path}</p>
            </CardContent>
            <CardFooter className="px-5 py-3 border-t border-border/50 text-xs text-muted-foreground flex justify-between bg-muted/20">
                <span>{new Date(project.last_opened).toLocaleDateString()}</span>
                <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
            </CardFooter>
        </Card>
    );
}

export default function Dashboard() {
    const [recents, setRecents] = useState<RecentProject[]>([]);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Dialog States
    const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
    const [countdown, setCountdown] = useState(2);

    const [projectToRename, setProjectToRename] = useState<{ path: string, name: string } | null>(null);
    const [newName, setNewName] = useState("");

    const navigate = useNavigate();

    useEffect(() => {
        // Use Mock API
        apiClient.invoke<RecentProject[]>('get_recent_projects').then(setRecents).catch(console.error);
    }, []);

    // Rename Effect
    useEffect(() => {
        if (projectToRename) setNewName(projectToRename.name);
    }, [projectToRename]);

    // Delete Countdown Effect
    useEffect(() => {
        if (projectToDelete && countdown > 0) {
            const timer = setTimeout(() => {
                setCountdown(prev => prev - 1);
            }, 1000);
            return () => clearTimeout(timer);
        } else if (!projectToDelete) {
            setCountdown(2);
        }
    }, [projectToDelete, countdown]);

    const handleImport = async () => {
        try {
            // open dialog relies on Tauri plugin, might fail in browser
            // Wrap or mock?
            // For now, keep as is, it might just throw in browser which is handled by catch
            const selected = await open({
                directory: true,
                multiple: false,
                title: "Open Existing Project"
            });
            if (selected && typeof selected === 'string') {
                await openProject(selected);
            }
        } catch (e) { console.error("Import failed (likely browser mode)", e); }
    };

    const openProject = async (path: string) => {
        try {
            await apiClient.invoke('init_project', { path });
            navigate('/editor');
        } catch (e) { console.error(e); }
    };

    const confirmDelete = async () => {
        if (!projectToDelete) return;
        try {
            await apiClient.invoke('delete_project', { path: projectToDelete });
            // Refresh
            const list = await apiClient.invoke<RecentProject[]>('get_recent_projects');
            setRecents(list || []);
            setProjectToDelete(null);
        } catch (e) {
            console.error(e);
            alert(`Failed to delete: ${e}`);
        }
    };

    const handleRenameProject = async () => {
        if (!projectToRename || !newName.trim()) return;

        try {
            await apiClient.invoke('rename_project', {
                oldPath: projectToRename.path,
                newName: newName.trim()
            });

            const list = await apiClient.invoke<RecentProject[]>('get_recent_projects');
            setRecents(list || []);
            setProjectToRename(null);
        } catch (e) {
            console.error(e);
            alert(`Failed to rename: ${e}`);
        }
    };

    return (
        <div className="h-full w-full bg-background text-foreground flex overflow-hidden font-sans relative">
            <NewProjectDialog
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                onCreated={() => navigate('/editor')}
            />

            {/* Rename Dialog */}
            <Dialog open={!!projectToRename} onOpenChange={(open) => !open && setProjectToRename(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Rename Project</DialogTitle>
                        <DialogDescription>
                            Enter a new name for your project. This will rename the folder on disk.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Name</Label>
                            <Input id="name" value={newName} onChange={(e) => setNewName(e.target.value)} className="col-span-3" autoFocus />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setProjectToRename(null)}>Cancel</Button>
                        <Button type="submit" onClick={handleRenameProject}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Exaggerated Delete Dialog */}
            <Dialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
                <DialogContent className="sm:max-w-[425px] border-destructive/50 shadow-2xl shadow-destructive/20">
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-background rounded-full border-4 border-destructive flex items-center justify-center shadow-lg z-20">
                        <SynniaSticker index={8} className="w-20 h-20 animate-pulse" />
                    </div>

                    <DialogHeader className="pt-10 text-center space-y-4">
                        <DialogTitle className="text-2xl font-black text-destructive tracking-tight uppercase">
                            Wait! Are you sure?!
                        </DialogTitle>
                        <DialogDescription className="text-base space-y-2">
                            <span className="block text-foreground font-medium">
                                You are about to delete:
                            </span>
                            <code className="block p-2 bg-muted rounded text-xs break-all font-mono border border-border">
                                {projectToDelete}
                            </code>
                            <span className="block text-destructive/80 text-sm">
                                This action is <b>permanent</b>. The files will be lost forever (a long time!).
                            </span>
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter className="sm:justify-center gap-4 mt-4">
                        <Button
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={() => setProjectToDelete(null)}
                        >
                            No, keep it!
                        </Button>
                        <Button
                            variant="destructive"
                            className="w-full sm:w-auto font-bold bg-destructive hover:bg-destructive/90"
                            onClick={confirmDelete}
                            disabled={countdown > 0}
                        >
                            {countdown > 0 ? `Wait (${countdown}s)` : 'Yes, Delete Forever'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Background Texture */}
            <div
                className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none bg-repeat z-0"
                style={{ backgroundImage: 'url("/assets/Seamless_Texture_Pack_app-texture-pack.png")', backgroundSize: '300px' }}
            />

            {/* Sidebar (Left) */}
            <div className="w-64 border-r bg-background/50 backdrop-blur flex flex-col p-6 z-10 h-full">
                <div className="flex items-center gap-3 mb-8">
                    <SynniaIcon className="w-16 h-16" interactive />
                    <span className="font-bold text-lg tracking-tight">Synnia</span>
                </div>

                <nav className="space-y-2 flex-1 min-h-0 overflow-y-auto">
                    <Button variant="ghost" className="w-full justify-start">
                        <FolderOpen className="w-4 h-4 mr-3 opacity-70" />
                        Projects
                    </Button>
                </nav>

                <div className="mt-auto pt-4 border-t border-border/50">
                    <div
                        className="p-4 rounded-lg bg-muted/50 border border-border hover:bg-muted hover:border-primary/30 cursor-pointer transition-all group"
                        onClick={() => apiClient.invoke('open_in_browser', { url: 'https://github.com/l1veIn/Synnia' })}
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-background rounded-full border border-border group-hover:border-primary/50 transition-colors">
                                <Github className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">Synnia GitHub</p>
                                <p className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors">Star us & Contribute!</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-10 overflow-y-auto z-10 h-full">
                <div className="max-w-5xl mx-auto pb-10">
                    {/* Hero Header */}
                    <div className="mb-12 flex items-end justify-between">
                        <div>
                            <h1 className="text-3xl font-bold mb-2 text-foreground">Welcome back, Creator.</h1>
                            <p className="text-muted-foreground">Ready to weave some digital magic?</p>
                        </div>
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={handleImport}
                                className="h-12"
                            >
                                Import Folder
                            </Button>
                            <Button
                                onClick={() => setIsCreateOpen(true)}
                                className="px-6 h-12 text-base shadow-lg shadow-primary/20"
                            >
                                <Plus className="w-5 h-5 mr-2" />
                                New Project
                            </Button>
                        </div>
                    </div>

                    {/* Recent Projects Grid */}
                    <div className="mb-6 flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        <Clock className="w-4 h-4" />
                        Recent Projects
                    </div>

                    {recents.length === 0 ? (
                        // Empty State
                        <div
                            className="border-2 border-dashed border-border rounded-2xl p-12 flex flex-col items-center justify-center text-center hover:border-primary/30 transition-colors cursor-pointer bg-card/30"
                            onClick={() => setIsCreateOpen(true)}
                        >
                            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
                                <FolderOpen className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <h3 className="text-xl font-medium mb-2">No projects found</h3>
                            <p className="text-muted-foreground max-w-md mb-6">
                                "Oops, looks like we got lost in the cloud! Let's find our way back by creating your first universe."
                            </p>
                            <Button variant="outline">
                                Create Project
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {recents.map((project, i) => (
                                <ProjectCard
                                    key={i}
                                    project={project}
                                    onClick={() => openProject(project.path)}
                                    onDelete={() => setProjectToDelete(project.path)}
                                    onRename={() => setProjectToRename(project)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}