![Synnia Banner](public/assets/banner1.jpeg)

# Synnia

> **From Chaos to Canon. Locally.**

[中文说明](./README.zh.md)

Hi there! 👋 I'm building Synnia, an open-source tool to help manage the chaos of creative assets in the AI era.



## What is Synnia?

Synnia is a **Digital Asset Consistency Engine**.

In most node-based tools (like ComfyUI), nodes are *functions* (do this -> do that).
In Synnia, nodes are **Assets** (your images, your text, your characters).

You place your assets on an infinite canvas, organize them, and use "Agents" (little helpers) to grow your project while keeping everything consistent.

I'm not a full-time professional developer, and I often found existing node-based tools a bit overwhelming. I started building Synnia because I wanted a workspace that felt intuitive and accessible—something with a gentle learning curve that invites you to play, rather than requiring you to study. It's designed for indie devs, writers, and world-builders who want to keep their creative universe cohesive.

## Current State (What I've built so far)

We just wrapped up a massive refactor (Architecture V4)! Here's what's working:

-   **Asset-Centric Architecture**: Separated the "Data" (Asset) from the "View" (Node). Your data lives independently of the canvas.
-   **Graph Engine V4**: A rewritten core that handles complex interactions, dragging, and connections much smoother than before.
-   **Smart Layouts (Rack Mode)**: Inspired by music production software. You can stack nodes into "Racks" that auto-resize and handle layout for you. No more manually aligning boxes!
-   **Dynamic Recipes**: We have a `RecipeNode` that generates input forms on the fly based on JSON Schemas.
-   **Tauri + React**: It runs locally on your machine. Fast and private.

## Roadmap (The To-Do List)

There is still a lot to do. Here is what I am working on next:

### 1. More "LEGO Bricks" (Nodes)
-   **Markdown Editor**: For better writing and documentation inside the canvas.
-   **JSON Editor**: For tweaking raw data.
-   **Debug Nodes**: To inspect what's actually flowing through those wires.

### 2. The Standard Kitchen (Basic Recipes)
-   Right now, you have to build everything from scratch. I want to add a standard library of "Recipes" like HTTP POST requests, text processing utils, etc., so you can start working immediately.

### 3. Meta-Recipes (The "App Store" moment)
-   **Recipe Composition**: Allow you to combine a Recipe + another Recipe + some Assets into a *New Recipe*.
-   **Sharing**: Ideally, you should be able to export your workflow as a single file and share it with others.

### 4. Upgrade the Brain (Storage)
-   Currently, everything is saved as JSON files. It works, but it's fragile.
-   **Database Migration**: Moving to a local database (SQLite?) for robust data handling.
-   **Virtual File System**: A proper system to manage files, auto-generate thumbnails, and handle large assets without lag.

## Contributing

I'm still learning React, Rust, and system architecture. If you see something that makes you say "why did he do it like that?", please open an issue or a PR! I'd love to learn from you.

---

*Built with ☕ and curiosity.*