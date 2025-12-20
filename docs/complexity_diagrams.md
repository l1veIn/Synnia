# Codebase Complexity Analysis

## 1. Complexity Distribution (The "Weight" of Modules)
This pie chart illustrates where the logical complexity resides in the project. It aligns with our rigorous review finding that the Engine and Recipe System carry the heaviest load.

```mermaid
pie title Synnia Codebase Complexity Weights
    "Graph Engine (Core Logic)" : 35
    "Recipe System (Executors & Dynamic Forms)" : 30
    "Node Implementations (Specific Logic)" : 15
    "Widget System (Form Controls)" : 10
    "UI Components (Shadcn/Basic)" : 5
    "Pages & Routing" : 5
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
      lib
        engine["engine (Red)"]
            ::icon(fa fa-cogs)
            GraphEngine
            LayoutSystem
            InteractionSystem
            PortRegistry
        recipes["recipes (Red)"]
            ::icon(fa fa-scroll)
            Executors
            Loaders
        models["models (Orange)"]
            LLM
            Media
      components
        workflow
            nodes["nodes (Orange)"]
                RecipeNode
                JSONNode
                BasicNodes
            widgets["widgets (Red)"]
                ::icon(fa fa-sliders-h)
                RecipeFormRenderer
                ModelConfigurator
        ui["ui (Green)"]
            shadcn-components
      store["store (Orange)"]
        workflowStore
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

    Engine[("Graph Engine")]:::high
    RecipeSys[("Recipe System")]:::high
    Widgets[("Widget System")]:::med
    Nodes[("Node Impls")]:::med
    Store["Zustand Store"]:::med
    Settings["Settings"]:::low
    Models["AI Models"]:::med
    
    %% Dependencies
    Nodes --> Engine
    Nodes --> RecipeSys
    Nodes --> Widgets
    
    RecipeSys --> Widgets
    RecipeSys --> Models
    
    Widgets --> Models
    Widgets --> Settings
    
    Engine --> Store
    Store -.->|Snapshot| Engine
```
