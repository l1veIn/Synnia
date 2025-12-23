// LLM Plugin System
// Central entry point for LLM functionality (for backward compatibility)

// Re-export registry and callLLM
export {
    llmRegistry,
    getLLMPlugin,
    getAllLLMPlugins,
    callLLM,
    // Backward compatibility exports
    getLLMModel,
    getAllLLMModels,
    getLLMModelsForCapability,
} from './registry';

export type {
    CallLLMOptions,
    LLMConfigValue,
    LLMModelDefinition,
} from './registry';

// Re-export types
export type { LLMPlugin, LLMExecutionInput, LLMExecutionResult, LLMCapability } from '../types';

// Re-export utility functions (now at root)
export { extractJson, repairTruncatedJsonArray } from '../utils';

// Re-export autoGenerate (now in shared/)
export { autoGenerate, type AutoGenerateOptions, type AutoGenerateResult } from '../shared/autoGenerate';

// ============================================================================
// Import and Register All LLM Plugins from Provider Directories
// ============================================================================

import { llmRegistry } from './registry';

// OpenAI
import { gpt4o, gpt4oMini } from '../openai/openai';
llmRegistry.register(gpt4o);
llmRegistry.register(gpt4oMini);

// Google
import { gemini2Flash, gemini25Flash } from '../google/google';
llmRegistry.register(gemini2Flash);
llmRegistry.register(gemini25Flash);

// DeepSeek
import { deepseekChat } from '../deepseek/deepseek';
llmRegistry.register(deepseekChat);

// Anthropic Claude
import { claude35Sonnet, claude35Haiku } from '../anthropic/anthropic';
llmRegistry.register(claude35Sonnet);
llmRegistry.register(claude35Haiku);

// Ollama (Local)
import { llama32, llama32Vision } from '../local/ollama';
llmRegistry.register(llama32);
llmRegistry.register(llama32Vision);

console.log(`[LLM] Registered ${llmRegistry.getAll().length} LLM plugins`);

