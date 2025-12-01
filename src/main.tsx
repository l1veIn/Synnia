import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "@/components/theme-provider";
import App from "./App";
import Dashboard from "./pages/Dashboard";
import CanvasPage from "./pages/Canvas";
import AgentsPage from "./pages/Agents"; // Import
import "./index.css";
import "@/lib/i18n";
import { HashRouter, Route, Routes } from "react-router-dom";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme" attribute="class">
      <HashRouter>
        <Routes>
          <Route path="/" element={<App />}>
            <Route index element={<Dashboard />} />
            <Route path="editor" element={<CanvasPage />} />
            <Route path="agents" element={<AgentsPage />} /> {/* New Route */}
          </Route>
        </Routes>
      </HashRouter>
    </ThemeProvider>
  </React.StrictMode>,
);