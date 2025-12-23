# Codebase Complexity Analysis

## 1. Complexity Distribution (The "Weight" of Modules)
This pie chart illustrates where the logical complexity resides in the project.

```mermaid
pie title Synnia Codebase Complexity Weights
    "Core Engine (GraphEngine, Layout, Ports)" : 35
    "Recipe System (Executors & Dynamic Forms)" : 25
    "Node Implementations (15+ Node Types)" : 20
    "Widget System (Form Controls)" : 10
    "AI Models Integration" : 5
    "UI Components (Shadcn/Basic)" : 5
```

## 2. Directory Structure & Depth Analysis
This mindmap visualizes the project structure, color-coded by complexity.
*   **Red**: Critical/High Complexity (Requires deep domain knowledge)
*   **Orange**: Medium Complexity (Component logic)
*   **Green**: Low Complexity (View/Drafting)

```mermaid
mindmap
  root((Synnia Project))
    src
      core["core/ (Red)"]
        engine
            GraphEngine
            LayoutSystem
            InteractionSystem
            AssetSystem
        registry
            NodeRegistry
            BehaviorRegistry
        utils
            graphUtils
            canvasUtils
      features["features/ (Red)"]
        recipes
            Executors
            Loaders
            BuiltinRecipes
        models
            LLM Plugins
            Media Plugins
      components
        workflow
            nodes["nodes (Orange)"]
                RecipeNode
                JSONNode
                FormNode
                GalleryNode
            widgets["widgets (Orange)"]
                FormRenderer
                ModelConfigurator
        ui["ui (Green)"]
            shadcn-components
        settings["settings (Green)"]
      store["store (Orange)"]
        workflowStore
      hooks["hooks (Orange)"]
        useRunRecipe
        useCanvasLogic
      types["types (Orange)"]
        assets
        project
        recipe
      pages["pages (Green)"]
        Canvas
        Dashboard
```

## 3. Dependency Density Network
Visualizing how modules depend on each other. The **Engine** and **Recipe System** are the high-traffic hubs.

```mermaid
graph TD
    classDef high fill:#f96,stroke:#333,stroke-width:2px;
    classDef med fill:#ffe,stroke:#333,stroke-width:1px;
    classDef low fill:#efe,stroke:#333,stroke-width:1px;

    Core[("Core Engine")]:::high
    RecipeSys[("Recipe System")]:::high
    Models[("AI Models")]:::med
    Widgets[("Widget System")]:::med
    Nodes[("Node Impls")]:::med
    Store["Zustand Store"]:::med
    Types["Types"]:::low
    Hooks["Hooks"]:::med
    
    %% Dependencies
    Nodes --> Core
    Nodes --> RecipeSys
    Nodes --> Widgets
    
    RecipeSys --> Models
    RecipeSys --> Core
    
    Widgets --> Models
    
    Core --> Store
    Core --> Types
    
    Hooks --> Core
    Hooks --> RecipeSys
    
    Store -.->|Snapshot| Core
```

## 4. Clean Architecture Layers

```mermaid
graph TB
    subgraph Presentation ["Presentation Layer"]
        Pages[Pages]
        Components[Components]
    end
    
    subgraph Application ["Application Layer"]
        Hooks[Hooks]
        Store[Store]
    end
    
    subgraph Domain ["Domain Layer"]
        Core[Core Engine]
        Features[Features]
    end
    
    subgraph Infrastructure ["Infrastructure"]
        Types[Types]
        Lib[Utilities]
    end
    
    Presentation --> Application
    Application --> Domain
    Domain --> Infrastructure
```
