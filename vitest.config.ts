import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node', // Use 'jsdom' for React component tests
        include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
        
        // Setup files run before each test file
        setupFiles: ['./src/test/setup.ts'],
        
        // Coverage configuration
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            reportsDirectory: './coverage',
            
            // Cover all source files
            include: [
                'src/**/*.ts',
                'src/**/*.tsx',
            ],
            exclude: [
                // Test files
                'src/**/*.test.ts',
                'src/**/*.test.tsx',
                'src/**/__tests__/**',
                'src/**/__mocks__/**',
                'src/test/**',
                
                // Type definitions
                'src/**/*.d.ts',
                'src/vite-env.d.ts',
                
                // Entry points
                'src/main.tsx',
                
                // UI primitives (shadcn)
                'src/components/ui/**',
                
                // Locales (translation files)
                'src/locales/**',
            ],
            
            // Coverage thresholds - Ralph backpressure
            thresholds: {
                statements: 60,
                branches: 50,
                functions: 60,
                lines: 60,
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@core': path.resolve(__dirname, './src/core'),
            '@features': path.resolve(__dirname, './src/features'),
            '@/bindings': path.resolve(__dirname, './src-tauri/bindings'),
        },
    },
});
