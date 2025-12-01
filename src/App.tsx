import { Outlet } from "react-router-dom";
import { CustomTitleBar } from "@/components/CustomTitleBar";
import { Toaster } from "sonner";
import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";

export default function App() {
  const [title, setTitle] = useState<string | undefined>(undefined);

  useEffect(() => {
    const init = async () => {
        const window = getCurrentWindow();
        await window.show();
        await window.setFocus(); 
        
        // Listen for project activation
        const unlisten = await listen<{ name: string }>('project:active', (e) => {
            setTitle(`Synnia / ${e.payload.name}`);
        });
        
        // Also listen for reset
        const unlistenReset = await listen('project:reset', () => {
            setTitle(undefined);
        });

        return () => {
            unlisten();
            unlistenReset();
        };
    };
    
    init();
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
