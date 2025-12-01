import { Outlet, NavLink, useLocation } from "react-router-dom";
import { CustomTitleBar } from "@/components/CustomTitleBar";
import { Toaster } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { cn } from "@/lib/utils";

export default function AppLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const isCanvas = location.pathname === "/canvas";

  useEffect(() => {
    const showWindow = async () => {
        const window = getCurrentWindow();
        await window.show();
        await window.setFocus(); 
    };
    showWindow();
  }, []);

  const links = [
    { to: "/", label: t("nav.home") },
    { to: "/canvas", label: "Canvas (Beta)" },
    { to: "/demo", label: t("nav.demo") },
  ];

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* 标题栏 */}
      <div className="shrink-0 h-9">
        <CustomTitleBar title={t("app.title")} />
      </div>
      
      <Toaster />

      {/* 导航栏 */}
      <nav className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border/50">
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} className="no-underline">
            {({ isActive }) => (
              <Button
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                className="font-medium h-8"
              >
                {link.label}
              </Button>
            )}
          </NavLink>
        ))}
      </nav>

      {/* 主内容 */}
      <main className="flex-1 min-h-0 overflow-hidden relative">
        <div className={cn(
          "h-full w-full",
          !isCanvas && "max-w-5xl mx-auto px-8 py-8 overflow-y-auto custom-scrollbar"
        )}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}