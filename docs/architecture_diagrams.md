# Synnia Architecture Visualizations

## 1. High-Level Architecture (MVC-ish)
This diagram illustrates the separation of concerns between the **View Layer** (React Components), **Logic Layer** (GraphEngine), and **Data Layer** (Zustand Store).

```mermaid
graph TD
    subgraph View ["View Layer (React)"]
        Canvas[Canvas.tsx]
        NodeComp[Node Components]
        Inspector[Inspector Panel]
        Widgets[Widget Registry]
    end

    subgraph Logic ["Logic Layer (Controller)"]
        Engine[GraphEngine]
        Layout[LayoutSystem]
        Interact[InteractionSystem]
        Mutator[GraphMutator]
        Assets[AssetSystem]
        Ports[PortRegistry]
    end

    subgraph Data ["Data Layer (Model)"]
        Store[Zustand Store]
        Nodes[Nodes State]
        Edges[Edges State]
        AssetsData[Assets State]
    end

    %% Relationships
    Canvas -->|User Actions| Engine
    Inspector -->|Config Changes| Engine
    
    Engine -->|Updates| Store
    Store -->|Re-renders| View
    
    %% Internal Logic
    Engine --> Layout
    Engine --> Interact
    Engine --> Mutator
    Engine --> Assets
    
    %% Widget Flow
    Widgets -.->|Render| Inspector
    NodeComp -.->|Render| Widgets
```

## 2. Project Directory Structure
Updated to reflect the new modular organization.

```mermaid
graph TD
    subgraph src ["src/"]
        subgraph core ["core/ (Engine Layer)"]
            engine[engine/]
            registry[registry/]
            utils[utils/]
        end
        
        subgraph features ["features/ (Domain Logic)"]
            recipes[recipes/]
            models[models/]
        end
        
        subgraph components ["components/ (View)"]
            workflow[workflow/nodes, widgets]
            ui[ui/ shadcn]
            settings[settings/]
        end
        
        hooks[hooks/]
        store[store/]
        types[types/]
        pages[pages/]
    end
    
    %% Dependencies
    components --> core
    components --> features
    features --> core
    hooks --> core
    hooks --> features
```

## 3. Recipe System Execution Flow
This diagram shows how a Recipe Node executes, from the user clicking "Run" to the final result updating the node.

```mermaid
sequenceDiagram
    participant User
    participant RecipeNode
    participant useRunRecipe
    participant ExecutorFactory
    participant Context as ExecutionContext
    participant LLMPlugin as AI Model Plugin
    
    User->>RecipeNode: Click "Run"
    RecipeNode->>useRunRecipe: runRecipe(nodeId, recipeId)
    
    useRunRecipe->>useRunRecipe: Resolve Inputs (Values + Connections)
    useRunRecipe->>ExecutorFactory: createExecutor(config)
    
    activate ExecutorFactory
    ExecutorFactory-->>useRunRecipe: Execution Function
    deactivate ExecutorFactory
    
    useRunRecipe->>Context: Build Context (Inputs, Meta)
    
    alt LLM Agent Recipe
        useRunRecipe->>LLMPlugin: execute()
        LLMPlugin->>ExternalAPI: API Call (OpenAI/Google)
        ExternalAPI-->>LLMPlugin: Response
        LLMPlugin-->>useRunRecipe: Parsed Result
    else Standard Recipe
        useRunRecipe->>ExecutorFactory: Run Logic (Template/HTTP)
        ExecutorFactory-->>useRunRecipe: Result
    end
    
    useRunRecipe->>RecipeNode: Update Node Data (executionResult)
    RecipeNode->>User: Show Result / Create New Nodes
```

## 4. Node Update & Optimization Flow
Illustrating the "Throttled Layout" pattern.

```mermaid
flowchart LR
    A[Update Request] --> B{"Affects Geometry?"}
    B -- Yes --> C[Fix Global Layout]
    B -- No --> D[Skip Layout]
    C --> E[Update Store]
    D --> E
    E --> F[React Re-render]
    
    style B fill:#f9f,stroke:#333
    style C fill:#f96,stroke:#333
```
