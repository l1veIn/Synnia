/**
 * Bot Feature Types
 *
 * Type definitions for the AI Assistant Bot feature.
 * Includes message types, tool definitions, and runtime configuration.
 */

import { z } from 'zod';

// ============================================================================
// Message Types
// ============================================================================

/**
 * Bot message roles
 */
export type BotMessageRole = 'user' | 'assistant' | 'system';

/**
 * Core message structure for bot conversations
 */
export interface BotMessage {
  id: string;
  role: BotMessageRole;
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  metadata?: Record<string, unknown>;
}

/**
 * Tool call representation
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}

// ============================================================================
// Tool Types
// ============================================================================

/**
 * Bot tool definition
 * Tools are capabilities the AI can use to interact with the canvas
 */
export interface BotTool {
  name: string;
  description: string;
  parameters: z.ZodType;
  execute: (params: unknown) => Promise<unknown>;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ============================================================================
// Runtime Types
// ============================================================================

/**
 * Configuration for the bot runtime
 */
export interface BotRuntimeConfig {
  /**
   * System prompt that defines the bot's behavior
   */
  systemPrompt: string;

  /**
   * Available tools the bot can use
   */
  tools: Record<string, BotTool>;

  /**
   * Maximum number of messages to keep in context
   */
  maxContextMessages?: number;

  /**
   * Initial messages to populate the conversation
   */
  initialMessages?: BotMessage[];
}

/**
 * Chat request sent to backend
 */
export interface ChatRequest {
  messages: BotMessage[];
  systemPrompt: string;
  tools: ToolDefinition[];
  modelId?: string;
}

/**
 * Tool definition sent to backend
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * Chat response from backend
 */
export interface ChatResponse {
  message: BotMessage;
  toolCalls?: ToolCall[];
}

// ============================================================================
// Bot History Types (for persistence - Phase 6)
// ============================================================================

/**
 * Bot conversation history session
 */
export interface BotHistorySession {
  id: string;
  createdAt: number;
  updatedAt: number;
  messages: BotMessage[];
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default system prompt for the Synnia AI Assistant
 */
export const DEFAULT_SYSTEM_PROMPT = `You are an AI assistant embedded in Synnia, a visual workflow canvas application.

Your role is to help users interact with the canvas through natural language. You can:
- View all nodes and their details
- Create new nodes (text, image, form, recipe, selector, gallery, table)
- Update existing nodes and assets
- Delete nodes (with user confirmation)

Guidelines:
- Always call \`get_nodes_list\` first to understand the current canvas state
- Be concise and clear in your responses
- When creating nodes, use smart positioning to avoid overlaps
- For destructive operations (delete), always confirm with the user
- Provide helpful context about what you did

Current canvas context:
- The user is working on a Synnia project
- You have access to the GraphEngine for all operations` as const;

/**
 * Maximum messages to keep in context (simple strategy per PRD)
 */
export const MAX_CONTEXT_MESSAGES = 10;
