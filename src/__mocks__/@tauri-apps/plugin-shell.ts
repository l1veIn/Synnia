/**
 * Mock for @tauri-apps/plugin-shell
 * Provides mock implementations for shell/command operations
 */

import { vi } from 'vitest';

// ============================================================================
// Command mock
// ============================================================================

export interface CommandOptions {
    cwd?: string;
    env?: Record<string, string>;
    encoding?: string;
}

export interface ChildProcess {
    code: number | null;
    signal: string | null;
    stdout: string;
    stderr: string;
}

let mockCommandResult: ChildProcess = {
    code: 0,
    signal: null,
    stdout: '',
    stderr: '',
};

export class Command {
    program: string;
    args: string[];
    options: CommandOptions;

    constructor(program: string, args: string[] = [], options: CommandOptions = {}) {
        this.program = program;
        this.args = args;
        this.options = options;
    }

    async execute(): Promise<ChildProcess> {
        return mockCommandResult;
    }

    async spawn(): Promise<{ pid: number; kill: () => Promise<void> }> {
        return {
            pid: 12345,
            kill: vi.fn(() => Promise.resolve()),
        };
    }

    static create = vi.fn((program: string, args?: string[], options?: CommandOptions) => {
        return new Command(program, args || [], options || {});
    });

    static sidecar = vi.fn((program: string, args?: string[], options?: CommandOptions) => {
        return new Command(program, args || [], options || {});
    });
}

// ============================================================================
// Open function (open URLs/files with default app)
// ============================================================================

export const open = vi.fn((_path: string) => {
    return Promise.resolve();
});

// ============================================================================
// Test utilities
// ============================================================================

export const __setCommandResult = (result: Partial<ChildProcess>) => {
    mockCommandResult = {
        code: result.code ?? 0,
        signal: result.signal ?? null,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
    };
};

export const __resetShellMocks = () => {
    mockCommandResult = {
        code: 0,
        signal: null,
        stdout: '',
        stderr: '',
    };
    open.mockClear();
    Command.create.mockClear();
    Command.sidecar.mockClear();
};

export default {
    Command,
    open,
    __setCommandResult,
    __resetShellMocks,
};
