# Synnia Agent Protocol Philosophy

> "From Chatbots to Functional Units. From Conversation to Composition."

## 1. Protocol over Platform
*   **Open Contract**: Every Agent must declare its `Input Schema` and `Output Schema`.
*   **Interoperability**: Agents are not isolated islands. Because they speak the same JSON language, they can talk to each other.
*   **Portability**: An Agent definition (Prompt + Schema) is just a text file. It can be shared, versioned, and forked.

## 2. Structured Creativity
*   **Beyond Chat**: While natural language is great for exploration, **Structure** is essential for production.
*   **Dynamic UI**: The UI is not hardcoded. It *morphs* based on what the Agent needs (Form Generation) and what the Agent produces (Component Rendering).
*   **No More Blank Canvas Anxiety**: Users don't face an empty chat box wondering "What should I say?". They face a structured form that guides them: "Fill this, pick that, and I'll do the rest."

## 3. The Meta-Agent Vision (Self-Evolution)
*   **Agents Creating Agents**: Since an Agent is just data (Schema + Prompt), we can have a "Meta-Agent" whose job is to write these definitions.
*   **User Empowerment**: Users transform from "Tool Users" to "Tool Makers". They don't need to learn Rust or Python to add a feature; they just need to describe it to the Meta-Agent.

---

## The Technical Trinity
1.  **Manifest**: The DNA of the Agent (Identity, Config).
2.  **Schema**: The Contract (Input/Output interfaces).
3.  **Action**: The Execution (LLM calls, Tool invocation).

## 4. The Feedback Loop (State & Iteration)
*   **Conversational Refinement**: Agents are not just one-shot functions. They support stateful sessions where users can say "Make it shorter" or "More like option B".
*   **Self-Correction**: Agents can call themselves recursively with new constraints based on user feedback or self-evaluation.
*   **Versioned History**: Every iteration is preserved as a node **Version**. The conversation thread that led to a specific version is attached to it, making the creative process traceable and reproducible.
