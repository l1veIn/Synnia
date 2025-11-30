import { Outlet, NavLink, useLocation } from "react-router-dom";
import { CustomTitleBar } from "@/components/CustomTitleBar";
import { Toaster } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export default function AppLayout() {
  const { t } = useTranslation();
  const location = useLocation();

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
    { to: "/demo", label: t("nav.demo") },
  ];

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* 标题栏 - 固定高度占位 */}
      <div className="shrink-0 h-9">
        <CustomTitleBar title={t("app.title")} />
      </div>
      
      <Toaster />

      {/* 导航栏 - 固定高度 */}
      <nav className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border/50">
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} className="no-underline">
            {({ isActive }) => (
              <Button
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                className="font-medium h-8"
                data-path={location.pathname}
              >
                {link.label}
              </Button>
            )}
          </NavLink>
        ))}
      </nav>

      {/* 主内容 - 占据剩余空间，内部可滚动 */}
      <main className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <div className="max-w-5xl mx-auto px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
