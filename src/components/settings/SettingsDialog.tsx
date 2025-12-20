// Settings Dialog - Main Entry Point
// Sidebar navigation with modular page components

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Settings, Brain, Sliders } from "lucide-react";
import { cn } from "@/lib/utils";
import { GeneralSettingsPage, ModelSettingsPage } from "./pages";

// ----------------------------------------------------------------------------
// Main Dialog
// ----------------------------------------------------------------------------

type ActiveTab = "general" | "models";

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("general");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl h-[600px] p-0 overflow-hidden gap-0 flex">
        {/* Visually hidden title/description for accessibility */}
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">Configure application settings</DialogDescription>

        {/* Sidebar */}
        <div className="w-64 bg-muted/30 border-r flex flex-col p-2 space-y-1">
          <div className="p-4 mb-2">
            <div className="font-semibold text-lg tracking-tight">Settings</div>
          </div>

          <SidebarButton
            active={activeTab === "general"}
            onClick={() => setActiveTab("general")}
            icon={<Sliders className="w-4 h-4" />}
          >
            General
          </SidebarButton>

          <SidebarButton
            active={activeTab === "models"}
            onClick={() => setActiveTab("models")}
            icon={<Brain className="w-4 h-4" />}
          >
            Models
          </SidebarButton>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden bg-background">
          {activeTab === "general" && <GeneralSettingsPage />}
          {activeTab === "models" && <ModelSettingsPage />}
        </div>

      </DialogContent>
    </Dialog>
  );
}

function SidebarButton({
  active,
  onClick,
  children,
  icon
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      className={cn(
        "w-full justify-start gap-3 px-4 font-normal",
        active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
      onClick={onClick}
    >
      {icon}
      {children}
    </Button>
  )
}
