![Synnia Banner](public/assets/banner1.jpeg)

# Synnia

> **From Chaos to Canon. Locally.**

[中文说明](./README.zh.md)

Hi there! 👋 I'm building Synnia, an open-source tool to help manage the chaos of creative assets in the AI era.



## What is Synnia?

Synnia is a **Digital Asset Consistency Engine**.

In most node-based tools (like ComfyUI), nodes are *functions* (do this -> do that).
In Synnia, nodes are **Assets** (your images, your text, your characters).

You place your assets on an infinite canvas, organize them, and use "Recipe" to grow your project while keeping everything consistent.

I'm not a full-time professional developer, and I often found existing node-based tools a bit overwhelming. I started building Synnia because I wanted a workspace that felt intuitive and accessible—something with a gentle learning curve that invites you to play, rather than requiring you to study. It's designed for indie devs, writers, and world-builders who want to keep their creative universe cohesive.

## Current State (Jan 2026)

A lot has happened since the initial release! Here's what's working now:

### Core Architecture
-   **Asset-Centric Architecture**: Separated the "Data" (Asset) from the "View" (Node). Your data lives independently of the canvas.
-   **Graph Engine V4**: A rewritten core that handles complex interactions, dragging, and connections smoothly.
-   **SQLite Backend**: Robust local database storage with Content-Addressable Storage (CAS) for assets.
-   **Modular Backend**: Clean Rust architecture with separated domains (assets, models, recipes).

### Recipe System V2
-   **YAML-Based Recipes**: Define workflows as declarative YAML packages with schemas, prompts, and executors.
-   **Recipe Package Architecture**: Self-contained recipe packages with manifests, schemas, and prompt templates.
-   **Built-in Recipe Library**: Ready-to-use recipes for creative work:
    - 🎭 **Storyteller** - Generate complete character soul profiles
    - 🎨 **Art Director** - Create visual blueprints and asset definitions
    - 📦 **Product Manager** - Production manifest generation
    - 🎬 **Media Recipes** - Image/video generation workflows
-   **Recipe IDE**: Built-in Mini-IDE for editing and managing recipes with multi-level category navigation.
-   **Edge Auto-Fill**: Connections automatically populate linked field values.

### Multi-Provider AI
-   **Unified Model System**: Single interface for multiple AI providers:
    - OpenAI (GPT-4o, DALL-E 3)
    - Anthropic (Claude 3.5 Sonnet)
    - Google AI (Gemini 2.0, Imagen)
    - FAL.ai (Flux, Kling)
    - Zhipu GLM (智谱)
    - OpenAI-compatible endpoints
-   **Multi-Turn Chat**: Support for conversational recipe execution.
-   **Unified Executor**: Standardized result handling across all providers.

### Developer Experience
-   **i18n Support**: Full internationalization with English and Chinese.
-   **Deep Data Editor**: Rich editor for complex nested data structures.
-   **MCP Bridge Integration**: AI assistants can screenshot, inspect, and debug your running app via [mcp-server-tauri](https://github.com/hypothesi/mcp-server-tauri).
-   **TypeScript Bindings**: Auto-generated types from Rust via ts-rs.

## Roadmap

### Near-Term
-   **More Node Types**: Markdown editor, JSON viewer, debug/inspection nodes.
-   **Recipe Sharing**: Export recipes as shareable packages.
-   **Performance**: Optimize for large canvases with many assets.

### Future Vision
-   **Meta-Recipes**: Compose recipes from other recipes + assets to create new workflows.
-   **Plugin System**: Extend Synnia with community-built nodes and recipes.
-   **Collaboration**: Real-time sync for team projects (exploring CRDTs).

## Tech Stack

- **Frontend**: React 19 + TypeScript + @xyflow/react + Radix UI + TailwindCSS
- **Backend**: Rust + Tauri 2.2 + SQLite + Actix-web
- **State**: Zustand + Zundo (undo/redo)
- **AI**: Vercel AI SDK + provider-specific SDKs

## Getting Started

```bash
# Clone the repo
git clone https://github.com/l1veIn/Synnia.git
cd synnia

# Install dependencies
pnpm install

# Run in dev mode
pnpm tauri:dev
```

## Contributing

I'm still learning React, Rust, and system architecture. If you see something that makes you say "why did he do it like that?", please open an issue or a PR! I'd love to learn from you.

---

*Built with ☕ and curiosity.*
