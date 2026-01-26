import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    FolderOpen,
    Plus,
    ChevronRight,
    Trash2,
    Search,
    Github,
    FileCode,
    Folder,
    Home,
    ArrowLeft
} from "lucide-react";
import { SynniaIcon } from "@/components/SynniaIcon";
import { apiClient } from '@/lib/apiClient';
import { DirectoryListing, RecipeEntry } from '@/types/recipe';
import { toast } from "sonner";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

function RecipeCard({
    entry,
    onClick,
    onDelete
}: {
    entry: RecipeEntry,
    onClick: () => void,
    onDelete: (e: React.MouseEvent) => void
}) {
    const isFolder = entry.type === 'folder';
    const Icon = isFolder ? Folder : FileCode;

    return (
        <Card
            className="group cursor-pointer hover:bg-accent/50 transition-all border-border relative overflow-hidden"
            onClick={onClick}
        >
            {/* Actions */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <Button
                    variant="destructive"
                    size="icon"
                    className="h-7 w-7"
                    onClick={onDelete}
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
            </div>

            <div className="h-32 bg-gradient-to-br from-muted/50 to-transparent flex items-center justify-center p-6 group-hover:scale-105 transition-transform duration-500">
                {entry.type === 'recipe' && entry.cover ? (
                    <img src={entry.cover} alt={entry.name} className="w-full h-full object-cover opacity-80" />
                ) : (
                    <Icon className={`w-16 h-16 ${isFolder ? 'text-primary/60' : 'text-blue-500/60'}`} />
                )}
            </div>

            <CardContent className="p-4">
                <CardTitle className="text-base mb-1 truncate flex items-center gap-2">
                    {entry.name}
                </CardTitle>
                <p className="text-xs text-muted-foreground truncate font-mono">
                    {entry.type === 'recipe' ? entry.id : entry.path}
                </p>
                {entry.type === 'recipe' && entry.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-2 h-8">
                        {entry.description}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

export default function RecipesPage() {
    const { t } = useTranslation(['common', 'recipe']);
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const currentPath = searchParams.get('path') || '';

    const [listing, setListing] = useState<DirectoryListing | null>(null);
    const [loading, setLoading] = useState(false);

    // Dialog States
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newItemName, setNewItemName] = useState("");
    const [createType, setCreateType] = useState<'folder' | 'recipe'>('recipe');

    useEffect(() => {
        loadDirectory(currentPath);
    }, [currentPath]);

    const loadDirectory = async (path: string) => {
        setLoading(true);
        try {
            const data = await apiClient.listRecipeDirectory(path);
            setListing(data);
        } catch (error) {
            console.error("Failed to load directory:", error);
            toast.error(t('recipe:errors.loadFailed'));
        } finally {
            setLoading(false);
        }
    };

    const handleNavigate = (path: string) => {
        setSearchParams({ path });
    };

    const handleBack = () => {
        if (!currentPath) return;
        const parent = currentPath.split('/').slice(0, -1).join('/');
        handleNavigate(parent);
    };

    const handleCreate = async () => {
        if (!newItemName.trim()) return;
        try {
            if (createType === 'folder') {
                await apiClient.createRecipeFolder(newItemName, currentPath);
                toast.success(t('recipe:folder.created'));
            } else {
                await apiClient.createRecipe(newItemName, currentPath);
                toast.success(t('recipe:item.created'));
            }
            setIsCreateOpen(false);
            setNewItemName("");
            loadDirectory(currentPath);
        } catch (error) {
            console.error("Create failed:", error);
            toast.error(t('recipe:errors.createFailed'));
        }
    };

    const handleDelete = async (entry: RecipeEntry) => {
        if (!confirm(`Are you sure you want to delete ${entry.name}?`)) return;
        try {
            await apiClient.deleteRecipe(entry.path);
            toast.success(t('recipe:item.deleted'));
            loadDirectory(currentPath);
        } catch (error) {
            console.error("Delete failed:", error);
            toast.error(t('recipe:errors.deleteFailed'));
        }
    };

    const handleItemClick = (entry: RecipeEntry) => {
        if (entry.type === 'folder') {
            handleNavigate(entry.path);
        } else {
            navigate(`/recipes/edit?path=${encodeURIComponent(entry.path)}`);
        }
    };

    const parts = currentPath ? currentPath.split('/') : [];

    return (
        <div className="h-full w-full bg-background text-foreground flex overflow-hidden font-sans relative">
            {/* Sidebar (Left) */}
            <div className="w-64 border-r bg-background/50 backdrop-blur flex flex-col p-6 z-10 h-full">
                <div className="flex items-center gap-3 mb-8">
                    <SynniaIcon className="w-16 h-16" interactive />
                    <span className="font-bold text-lg tracking-tight">Synnia</span>
                </div>

                <nav className="space-y-2 flex-1 min-h-0 overflow-y-auto">
                    <Button
                        variant="ghost"
                        className="w-full justify-start text-muted-foreground"
                        onClick={() => navigate('/')}
                    >
                        <FolderOpen className="w-4 h-4 mr-3 opacity-70" />
                        {t('common:nav.projects')}
                    </Button>
                    <Button
                        variant="secondary"
                        className="w-full justify-start font-medium bg-accent/50"
                    >
                        <FileCode className="w-4 h-4 mr-3 text-primary" />
                        {t('common:nav.recipes')}
                    </Button>
                </nav>

                <div className="mt-auto pt-4 border-t border-border/50">
                    <div className="p-4 rounded-lg bg-muted/50 border border-border cursor-pointer flex items-center gap-3 opacity-50">
                        <Github className="w-5 h-5" />
                        <span className="text-sm">{t('common:nav.github')}</span>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-8 overflow-y-auto">
                <div className="max-w-6xl mx-auto">
                    {/* Header & Toolbar */}
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            {currentPath && (
                                <Button variant="outline" size="icon" onClick={handleBack}>
                                    <ArrowLeft className="w-4 h-4" />
                                </Button>
                            )}
                            <Breadcrumb>
                                <BreadcrumbList>
                                    <BreadcrumbItem>
                                        <BreadcrumbLink className="cursor-pointer flex items-center gap-2" onClick={() => handleNavigate('')}>
                                            <Home className="w-4 h-4" />
                                            Root
                                        </BreadcrumbLink>
                                    </BreadcrumbItem>
                                    {parts.map((part, index) => {
                                        const path = parts.slice(0, index + 1).join('/');
                                        const isLast = index === parts.length - 1;
                                        return (
                                            <div key={path} className="flex items-center">
                                                <BreadcrumbSeparator />
                                                <BreadcrumbItem>
                                                    {isLast ? (
                                                        <BreadcrumbPage>{part}</BreadcrumbPage>
                                                    ) : (
                                                        <BreadcrumbLink className="cursor-pointer" onClick={() => handleNavigate(path)}>
                                                            {part}
                                                        </BreadcrumbLink>
                                                    )}
                                                </BreadcrumbItem>
                                            </div>
                                        );
                                    })}
                                </BreadcrumbList>
                            </Breadcrumb>
                        </div>

                        <div className="flex gap-2">
                            <div className="relative w-64">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input placeholder={t('recipe:search.placeholder')} className="pl-8" />
                            </div>
                            <Button onClick={() => { setCreateType('folder'); setIsCreateOpen(true); }} variant="outline">
                                <Folder className="w-4 h-4 mr-2" />
                                {t('recipe:actions.newFolder')}
                            </Button>
                            <Button onClick={() => { setCreateType('recipe'); setIsCreateOpen(true); }}>
                                <Plus className="w-4 h-4 mr-2" />
                                {t('recipe:actions.newRecipe')}
                            </Button>
                        </div>
                    </div>

                    {/* Grid */}
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                        </div>
                    ) : (
                        listing?.entries.length === 0 ? (
                            <div className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-xl">
                                <p>{t('recipe:empty.folder')}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                {listing?.entries.map((entry) => (
                                    <RecipeCard
                                        key={entry.path}
                                        entry={entry}
                                        onClick={() => handleItemClick(entry)}
                                        onDelete={(e) => { e.stopPropagation(); handleDelete(entry); }}
                                    />
                                ))}
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* Create Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New {createType === 'recipe' ? 'Recipe' : 'Folder'}</DialogTitle>
                        <DialogDescription>
                            Enter a unique name (ID) for the new {createType}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label>Name (ID)</Label>
                        <Input
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            placeholder={createType === 'recipe' ? "my-new-recipe" : "my-folder"}
                            autoFocus
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                            Use lowercase letters, numbers, and hyphens only.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>{t('common:actions.cancel')}</Button>
                        <Button onClick={handleCreate}>{t('common:actions.create')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
