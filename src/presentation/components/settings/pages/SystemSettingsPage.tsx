/**
 * SystemSettingsPage - Application-level settings
 * - Project directory
 * - User recipes directory  
 * - Refresh actions
 */

import { useState, useEffect } from "react";
import { Label } from "@/presentation/components/ui/label";
import { Input } from "@/presentation/components/ui/input";
import { Button } from "@/presentation/components/ui/button";
import { toast } from "sonner";
import { FolderOpen, RefreshCw, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { useRecipeStore } from "@/store/recipeStore";
import { open } from "@tauri-apps/plugin-dialog";

interface SystemSettings {
    projectsDir: string;
    userRecipesDir: string;
}

export function SystemSettingsPage() {
    const [settings, setSettings] = useState<SystemSettings>({
        projectsDir: "",  // Loaded from backend
        userRecipesDir: "",  // Loaded from backend
    });
    const [loading, setLoading] = useState(false);
    const [refreshingRecipes, setRefreshingRecipes] = useState(false);
    const [refreshingProjects, setRefreshingProjects] = useState(false);

    // Load current settings
    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            // Use dedicated commands that return expanded paths
            const [projectsDir, userRecipesDir] = await Promise.all([
                apiClient.invoke<string>("get_projects_directory"),
                apiClient.invoke<string>("get_user_recipes_directory"),
            ]);

            setSettings({
                projectsDir: projectsDir || "",
                userRecipesDir: userRecipesDir || "",
            });
        } catch (e) {
            console.warn("Failed to load system settings:", e);
        }
    };

    const handleBrowseFolder = async (field: keyof SystemSettings) => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: field === "projectsDir" ? "Select Projects Directory" : "Select User Recipes Directory",
            });

            if (selected && typeof selected === "string") {
                setSettings(prev => ({ ...prev, [field]: selected }));

                // Save using dedicated commands
                const command = field === "projectsDir" ? "set_projects_directory" : "set_user_recipes_directory";
                await apiClient.invoke(command, { path: selected });
                toast.success("Directory updated");
            }
        } catch (e) {
            console.error("Failed to select folder:", e);
        }
    };

    const handleRefreshRecipes = async () => {
        setRefreshingRecipes(true);
        try {
            // Force full rescan by calling sync
            await apiClient.invoke("sync_recipe_index");

            // Refresh frontend store
            await useRecipeStore.getState().refreshIndex();

            toast.success("Recipe index refreshed");
        } catch (e: any) {
            toast.error(`Failed to refresh: ${e.message || e}`);
        } finally {
            setRefreshingRecipes(false);
        }
    };

    const handleRefreshProjects = async () => {
        setRefreshingProjects(true);
        try {
            await apiClient.invoke("validate_projects");
            toast.success("Project list refreshed");
        } catch (e: any) {
            toast.error(`Failed to refresh: ${e.message || e}`);
        } finally {
            setRefreshingProjects(false);
        }
    };

    const handleClearRecipeCache = async () => {
        try {
            // Clear the recipe index and rescan
            await apiClient.invoke("clear_recipe_index");
            await handleRefreshRecipes();
            toast.success("Recipe cache cleared and rebuilt");
        } catch (e: any) {
            // If clear_recipe_index doesn't exist, just refresh
            await handleRefreshRecipes();
        }
    };

    return (
        <div className="h-full flex flex-col p-8 space-y-6 overflow-y-auto">
            <div>
                <h2 className="text-lg font-semibold tracking-tight">System Settings</h2>
                <p className="text-sm text-muted-foreground">
                    Configure application directories and manage indexes
                </p>
            </div>

            <div className="space-y-6">
                {/* Projects Directory */}
                <div className="space-y-2">
                    <Label>Projects Directory</Label>
                    <p className="text-[12px] text-muted-foreground">
                        Default location for new projects
                    </p>
                    <div className="flex gap-2 max-w-lg">
                        <Input
                            value={settings.projectsDir}
                            onChange={(e) => setSettings(prev => ({ ...prev, projectsDir: e.target.value }))}
                            className="flex-1 font-mono text-sm"
                            readOnly
                        />
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleBrowseFolder("projectsDir")}
                        >
                            <FolderOpen className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* User Recipes Directory */}
                <div className="space-y-2">
                    <Label>User Recipes Directory</Label>
                    <p className="text-[12px] text-muted-foreground">
                        Location for user-created recipes
                    </p>
                    <div className="flex gap-2 max-w-lg">
                        <Input
                            value={settings.userRecipesDir}
                            onChange={(e) => setSettings(prev => ({ ...prev, userRecipesDir: e.target.value }))}
                            className="flex-1 font-mono text-sm"
                            readOnly
                        />
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleBrowseFolder("userRecipesDir")}
                        >
                            <FolderOpen className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Divider */}
                <div className="border-t pt-6">
                    <h3 className="text-sm font-medium mb-4">Index Management</h3>

                    <div className="space-y-3">
                        {/* Refresh Recipes */}
                        <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/20 max-w-lg">
                            <div>
                                <div className="font-medium text-sm">Recipe Index</div>
                                <div className="text-xs text-muted-foreground">
                                    Scan and update the recipe database
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRefreshRecipes}
                                disabled={refreshingRecipes}
                            >
                                {refreshingRecipes ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                )}
                                {refreshingRecipes ? "Refreshing..." : "Refresh"}
                            </Button>
                        </div>

                        {/* Refresh Projects */}
                        <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/20 max-w-lg">
                            <div>
                                <div className="font-medium text-sm">Project List</div>
                                <div className="text-xs text-muted-foreground">
                                    Validate and refresh recent projects
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRefreshProjects}
                                disabled={refreshingProjects}
                            >
                                {refreshingProjects ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                )}
                                {refreshingProjects ? "Refreshing..." : "Refresh"}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
