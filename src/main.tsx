import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "@/components/theme-provider";
import App from "./App";
import Dashboard from "./pages/Dashboard";
import CanvasPage from "./pages/Canvas";
import RecipesPage from "./pages/RecipesPage";
import RecipeEditorPage from "./pages/RecipeEditorPage";
import "./index.css";
import "@/lib/i18n";
import { HashRouter, Route, Routes } from "react-router-dom"; // Import Navigate
import { loadSettings } from "@/lib/settings";
import { invoke } from "@tauri-apps/api/core";

// Ignore ResizeObserver loop limit exceeded error
const resizeObserverLoopErr = 'ResizeObserver loop completed with undelivered notifications.';
window.addEventListener('error', (e) => {
  if (e.message && e.message.includes(resizeObserverLoopErr)) {
    e.stopImmediatePropagation();
  }
});

// Preload settings before rendering to ensure cachedSettings is available
loadSettings().then(() => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme" attribute="class">
        <HashRouter>
          <Routes>
            <Route path="/" element={<App />}>
              <Route index element={<Dashboard />} />
              <Route path="editor" element={<CanvasPage />} />
              <Route path="recipes" element={<RecipesPage />} />
              <Route path="recipes/edit" element={<RecipeEditorPage />} />
            </Route>
          </Routes>
        </HashRouter>
      </ThemeProvider>
    </React.StrictMode>,
  );
});