import { Outlet } from "react-router-dom";
import { CustomTitleBar } from "@/components/CustomTitleBar";
import { Toaster } from "sonner";
import { useState, useEffect } from "react";
import { useRecipeStore } from "@/store/recipeStore";

export default function App() {
  const [title, setTitle] = useState<string | undefined>(undefined);

  // Initialize RecipeStore on app start
  useEffect(() => {
    const store = useRecipeStore.getState();

    // Load cached metas from SQLite
    store.loadMetas();

    // Setup event listeners for background updates
    let unlisten: (() => void) | undefined;
    store.setupEventListeners().then((fn) => {
      unlisten = fn;
    });

    // Trigger background scan for recipe updates
    store.refreshIndex();

    return () => {
      unlisten?.();
    };
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
      <div className="shrink-0 h-9 z-50 relative">
        <CustomTitleBar title={title} />
      </div>

      <Toaster position="bottom-right" />

      <main className="flex-1 w-full h-full relative overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
