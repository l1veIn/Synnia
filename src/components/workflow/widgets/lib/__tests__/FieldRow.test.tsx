// @ts-nocheck
/**
 * FieldRow Component Tests
 * Tests for RecipeFieldRow and RecipeFormRenderer components
 * @vitest-environment jsdom
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { RecipeFieldRow, RecipeFormRenderer } from '../FieldRow';
import { FieldDefinition } from '@/types/assets';
import { widgetRegistry } from '../registry';
import { WidgetDefinition } from '../types';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@xyflow/react', async () => {
    const actual = await vi.importActual('@xyflow/react');
    return {
        ...actual,
        useNodeConnections: vi.fn(() => []),
    };
});

// Mock the cn utility
vi.mock('@/lib/utils', () => ({
    cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));

// Mock NodePort component - needs to match the absolute import path used in FieldRow.tsx
vi.mock('@/components/workflow/nodes/primitives/NodePort', () => ({
    NodePort: {
        Input: ({ id, connected }: { id: string; connected?: boolean }) => (
            <div data-testid={`input-handle-${id}`} data-connected={connected}>
                InputHandle
            </div>
        ),
        Output: ({ id }: { id: string }) => (
            <div data-testid={`output-handle-${id}`}>OutputHandle</div>
        ),
    },
}));

import { useNodeConnections } from '@xyflow/react';

// ============================================================================
// Test Helpers
// ============================================================================

const createMockField = (overrides: Partial<FieldDefinition> = {}): FieldDefinition => ({
    key: 'testField',
    type: 'string',
    label: 'Test Field',
    ...overrides,
});

const createMockWidget = (overrides: Partial<WidgetDefinition> = {}): WidgetDefinition => ({
    id: 'test-widget',
    render: () => null,
    ...overrides,
});

// Wrapper for ReactFlow context
function TestWrapper({ children }: { children: React.ReactNode }) {
    return <ReactFlowProvider>{children}</ReactFlowProvider>;
}

// ============================================================================
// RecipeFieldRow Tests
// ============================================================================

describe('RecipeFieldRow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useNodeConnections).mockReturnValue([]);
    });

    describe('basic rendering', () => {
        it('should render field row with label', () => {
            const field = createMockField({ label: 'My Field', key: 'myField' });

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value="test value" />
                </TestWrapper>
            );

            expect(screen.getByText('My Field')).toBeInTheDocument();
        });

        it('should use field key as fallback label when label is not provided', () => {
            const field = createMockField({ label: undefined, key: 'fallbackKey' });

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value="test" />
                </TestWrapper>
            );

            expect(screen.getByText('fallbackKey')).toBeInTheDocument();
        });

        it('should render value when not connected', () => {
            const field = createMockField();

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value="my value" />
                </TestWrapper>
            );

            expect(screen.getByText('my value')).toBeInTheDocument();
        });

        it('should display "empty" for undefined value', () => {
            const field = createMockField();

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value={undefined} />
                </TestWrapper>
            );

            expect(screen.getByText('empty')).toBeInTheDocument();
        });

        it('should display "empty" for null value', () => {
            const field = createMockField();

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value={null} />
                </TestWrapper>
            );

            expect(screen.getByText('empty')).toBeInTheDocument();
        });

        it('should display "empty" for empty string value', () => {
            const field = createMockField();

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value="" />
                </TestWrapper>
            );

            expect(screen.getByText('empty')).toBeInTheDocument();
        });
    });

    describe('connection states', () => {
        it('should show connected state when useNodeConnections returns connections', () => {
            const field = createMockField();
            vi.mocked(useNodeConnections).mockReturnValue([{ source: 'node1', target: 'node2' } as any]);

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value="test" />
                </TestWrapper>
            );

            expect(screen.getByText('linked')).toBeInTheDocument();
        });

        it('should show "linked" badge with connected state', () => {
            const field = createMockField();
            vi.mocked(useNodeConnections).mockReturnValue([{ source: 'node1' } as any]);

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value="test" />
                </TestWrapper>
            );

            const linkedBadge = screen.getByText('linked');
            expect(linkedBadge).toBeInTheDocument();
            // The badge itself should have the blue styling
            expect(linkedBadge).toHaveClass('bg-blue-500/10');
        });

        it('should not show value when connected', () => {
            const field = createMockField();
            vi.mocked(useNodeConnections).mockReturnValue([{ source: 'node1' } as any]);

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value="test value" />
                </TestWrapper>
            );

            // Value should not be visible when connected
            expect(screen.queryByText('test value')).not.toBeInTheDocument();
            // But linked badge should be visible
            expect(screen.getByText('linked')).toBeInTheDocument();
        });
    });

    describe('input handle rendering', () => {
        it('should render input handle when connection is "input"', () => {
            const field = createMockField({ key: 'inputField', connection: 'input' });

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value="test" />
                </TestWrapper>
            );

            expect(screen.getByTestId('input-handle-inputField')).toBeInTheDocument();
        });

        it('should render input handle when connection is "both"', () => {
            const field = createMockField({ key: 'bothField', connection: 'both' });

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value="test" />
                </TestWrapper>
            );

            expect(screen.getByTestId('input-handle-bothField')).toBeInTheDocument();
        });

        it('should render input handle when widget is "form-input"', () => {
            const field = createMockField({ key: 'formField', widget: 'form-input' });

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value="test" />
                </TestWrapper>
            );

            expect(screen.getByTestId('input-handle-formField')).toBeInTheDocument();
        });

        it('should render input handle when widget is "table-input"', () => {
            const field = createMockField({ key: 'tableField', widget: 'table-input' });

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value="test" />
                </TestWrapper>
            );

            expect(screen.getByTestId('input-handle-tableField')).toBeInTheDocument();
        });

        it('should render input handle when type is "object"', () => {
            const field = createMockField({ key: 'objectField', type: 'object' });

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value="test" />
                </TestWrapper>
            );

            expect(screen.getByTestId('input-handle-objectField')).toBeInTheDocument();
        });

        it('should render input handle when type is "array"', () => {
            const field = createMockField({ key: 'arrayField', type: 'array' });

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value="test" />
                </TestWrapper>
            );

            expect(screen.getByTestId('input-handle-arrayField')).toBeInTheDocument();
        });

        it('should not render input handle when connection is "output"', () => {
            const field = createMockField({ key: 'outputField', connection: 'output' });

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value="test" />
                </TestWrapper>
            );

            expect(screen.queryByTestId('input-handle-outputField')).not.toBeInTheDocument();
        });

        it('should not render input handle when connection is not set and type is string', () => {
            const field = createMockField({ key: 'stringField', type: 'string' });

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value="test" />
                </TestWrapper>
            );

            expect(screen.queryByTestId('input-handle-stringField')).not.toBeInTheDocument();
        });
    });

    describe('output handle rendering', () => {
        it('should render output handle when connection is "output"', () => {
            const field = createMockField({ key: 'outputField', connection: 'output' });

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value="test" />
                </TestWrapper>
            );

            expect(screen.getByTestId('output-handle-field:outputField')).toBeInTheDocument();
        });

        it('should render output handle when connection is "both"', () => {
            const field = createMockField({ key: 'bothField', connection: 'both' });

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value="test" />
                </TestWrapper>
            );

            expect(screen.getByTestId('output-handle-field:bothField')).toBeInTheDocument();
        });

        it('should not render output handle when connection is "input"', () => {
            const field = createMockField({ key: 'inputField', connection: 'input' });

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value="test" />
                </TestWrapper>
            );

            expect(screen.queryByTestId('output-handle-field:inputField')).not.toBeInTheDocument();
        });

        it('should not render output handle when connection is not set', () => {
            const field = createMockField({ key: 'noConnField', type: 'string' });

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value="test" />
                </TestWrapper>
            );

            expect(screen.queryByTestId('output-handle-field:noConnField')).not.toBeInTheDocument();
        });
    });

    describe('disabled/hidden state', () => {
        it('should apply disabled styles when field.hidden is true', () => {
            const field = createMockField({ hidden: true });

            const { container } = render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value="test" />
                </TestWrapper>
            );

            const row = container.querySelector('.bg-muted\\/30');
            expect(row).toBeInTheDocument();
        });
    });

    describe('validation states', () => {
        it('should show validation error for required field with empty value', () => {
            const field = createMockField({ required: true });

            const { container } = render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value="" />
                </TestWrapper>
            );

            const row = container.querySelector('.border-destructive\\/40');
            expect(row).toBeInTheDocument();
        });

        it('should show validation error for required field with undefined value', () => {
            const field = createMockField({ required: true });

            const { container } = render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value={undefined} />
                </TestWrapper>
            );

            const row = container.querySelector('.border-destructive\\/40');
            expect(row).toBeInTheDocument();
        });

        it('should show validation error for required field with null value', () => {
            const field = createMockField({ required: true });

            const { container } = render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value={null} />
                </TestWrapper>
            );

            const row = container.querySelector('.border-destructive\\/40');
            expect(row).toBeInTheDocument();
        });

        it('should not show validation error when required field has value', () => {
            const field = createMockField({ required: true });

            const { container } = render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value="some value" />
                </TestWrapper>
            );

            const row = container.querySelector('.border-destructive\\/40');
            expect(row).not.toBeInTheDocument();
        });

        it('should not show validation error when field is connected even with empty value', () => {
            const field = createMockField({ required: true });
            vi.mocked(useNodeConnections).mockReturnValue([{ source: 'node1' } as any]);

            const { container } = render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value="" />
                </TestWrapper>
            );

            const row = container.querySelector('.border-destructive\\/40');
            expect(row).not.toBeInTheDocument();
        });

        it('should not show validation error for non-required field with empty value', () => {
            const field = createMockField({ required: false });

            const { container } = render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value="" />
                </TestWrapper>
            );

            const row = container.querySelector('.border-destructive\\/40');
            expect(row).not.toBeInTheDocument();
        });
    });

    describe('value formatting', () => {
        it('should display boolean true as "Yes"', () => {
            const field = createMockField();

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value={true} />
                </TestWrapper>
            );

            expect(screen.getByText('Yes')).toBeInTheDocument();
        });

        it('should display boolean false as "No"', () => {
            const field = createMockField();

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value={false} />
                </TestWrapper>
            );

            expect(screen.getByText('No')).toBeInTheDocument();
        });

        it('should truncate long strings', () => {
            const field = createMockField();
            const longString = 'a'.repeat(30);

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value={longString} />
                </TestWrapper>
            );

            expect(screen.getByText(`${'a'.repeat(25)}...`)).toBeInTheDocument();
        });

        it('should display array with item count', () => {
            const field = createMockField();

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value={[1, 2, 3, 4, 5]} />
                </TestWrapper>
            );

            expect(screen.getByText('[5 items]')).toBeInTheDocument();
        });

        it('should display empty array item count', () => {
            const field = createMockField();

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value={[]} />
                </TestWrapper>
            );

            expect(screen.getByText('[0 items]')).toBeInTheDocument();
        });

        it('should display object as truncated JSON', () => {
            const field = createMockField();

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value={{ key: 'value', another: 'data' }} />
                </TestWrapper>
            );

            expect(screen.getByText(/.*\.\.\.$/)).toBeInTheDocument();
        });

        it('should display image placeholder for object with url property', () => {
            const field = createMockField();

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value={{ url: 'http://example.com/image.png' } } />
                </TestWrapper>
            );

            expect(screen.getByText('🖼️ Image')).toBeInTheDocument();
        });

        it('should display image placeholder for object with base64 property', () => {
            const field = createMockField();

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value={{ base64: 'data:image/png;base64,abc123' } } />
                </TestWrapper>
            );

            expect(screen.getByText('🖼️ Image')).toBeInTheDocument();
        });

        it('should display model ID for LLMConfigValue', () => {
            const field = createMockField();

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value={{ modelId: 'openai-gpt-4-preview' } } />
                </TestWrapper>
            );

            expect(screen.getByText('Openai-Gpt-4')).toBeInTheDocument();
        });

        it('should truncate long model names', () => {
            const field = createMockField();

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value={{ modelId: 'very-long-model-name-with-many-hyphens-preview' } } />
                </TestWrapper>
            );

            const displayed = screen.getByText(/.*\.\.\.$/);
            expect(displayed).toBeInTheDocument();
        });
    });

    describe('widget custom content rendering', () => {
        it('should use widget renderFieldContent when available', () => {
            const field = createMockField({ widget: 'custom-widget' });
            const customWidget = createMockWidget({
                id: 'custom-widget',
                renderFieldContent: ({ value }) => <div data-testid="custom-content">{value}</div>,
            });
            widgetRegistry.register(customWidget);

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value="custom value" />
                </TestWrapper>
            );

            expect(screen.getByTestId('custom-content')).toBeInTheDocument();
            expect(screen.getByText('custom value')).toBeInTheDocument();
        });

        it('should pass correct props to widget renderFieldContent', () => {
            const field = createMockField({ widget: 'props-widget', key: 'testKey' });
            let receivedProps: any = null;
            const propsWidget = createMockWidget({
                id: 'props-widget',
                renderFieldContent: (props) => {
                    receivedProps = props;
                    return <div>Props Test</div>;
                },
            });
            widgetRegistry.register(propsWidget);
            const onChange = vi.fn();

            render(
                <TestWrapper>
                    <RecipeFieldRow
                        field={field}
                        value="test value"
                        connectedValues={{ otherKey: 'other value' }}
                        onChange={onChange}
                    />
                </TestWrapper>
            );

            expect(receivedProps).toMatchObject({
                field,
                value: 'test value',
                onChange,
                connectedValues: { otherKey: 'other value' },
            });
            expect(typeof receivedProps.onChange).toBe('function');
        });

        it('should provide default onChange when not provided', () => {
            const field = createMockField({ widget: 'no-change-widget' });
            let receivedProps: any = null;
            const widget = createMockWidget({
                id: 'no-change-widget',
                renderFieldContent: (props) => {
                    receivedProps = props;
                    return <div>No Change Test</div>;
                },
            });
            widgetRegistry.register(widget);

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value="test" />
                </TestWrapper>
            );

            // Should not throw when onChange is called
            expect(() => receivedProps.onChange('new value')).not.toThrow();
        });
    });
});

// ============================================================================
// DefaultValueContent Tests (via RecipeFieldRow)
// ============================================================================

describe('DefaultValueContent formatting', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useNodeConnections).mockReturnValue([]);
    });

    describe('number values', () => {
        it('should display number values correctly', () => {
            const field = createMockField();

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value={42} />
                </TestWrapper>
            );

            expect(screen.getByText('42')).toBeInTheDocument();
        });

        it('should display decimal values correctly', () => {
            const field = createMockField();

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value={3.14159} />
                </TestWrapper>
            );

            expect(screen.getByText('3.14159')).toBeInTheDocument();
        });

        it('should display negative numbers correctly', () => {
            const field = createMockField();

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value={-100} />
                </TestWrapper>
            );

            expect(screen.getByText('-100')).toBeInTheDocument();
        });

        it('should display zero correctly', () => {
            const field = createMockField();

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value={0} />
                </TestWrapper>
            );

            expect(screen.getByText('0')).toBeInTheDocument();
        });
    });

    describe('edge cases', () => {
        it('should handle value of 0 as falsy but valid', () => {
            const field = createMockField({ required: true });

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value={0} />
                </TestWrapper>
            );

            // 0 is a valid value, should not show validation error
            expect(screen.getByText('0')).toBeInTheDocument();
        });

        it('should handle value of false as falsy but valid', () => {
            const field = createMockField({ required: true });

            render(
                <TestWrapper>
                    <RecipeFieldRow field={field} value={false} />
                </TestWrapper>
            );

            // false is a valid value
            expect(screen.getByText('No')).toBeInTheDocument();
        });
    });
});

// ============================================================================
// RecipeFormRenderer Tests
// ============================================================================

describe('RecipeFormRenderer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useNodeConnections).mockReturnValue([]);
    });

    describe('basic rendering', () => {
        it('should render all visible fields when not collapsed', () => {
            const fields = [
                createMockField({ key: 'field1', label: 'Field 1' }),
                createMockField({ key: 'field2', label: 'Field 2' }),
                createMockField({ key: 'field3', label: 'Field 3' }),
            ];
            const values = { field1: 'value1', field2: 'value2', field3: 'value3' };

            render(
                <TestWrapper>
                    <RecipeFormRenderer fields={fields} values={values} />
                </TestWrapper>
            );

            expect(screen.getByText('Field 1')).toBeInTheDocument();
            expect(screen.getByText('Field 2')).toBeInTheDocument();
            expect(screen.getByText('Field 3')).toBeInTheDocument();
        });

        it('should render values correctly', () => {
            const fields = [
                createMockField({ key: 'field1', label: 'Field 1' }),
                createMockField({ key: 'field2', label: 'Field 2' }),
            ];
            const values = { field1: 'value1', field2: 'value2' };

            render(
                <TestWrapper>
                    <RecipeFormRenderer fields={fields} values={values} />
                </TestWrapper>
            );

            expect(screen.getByText('value1')).toBeInTheDocument();
            expect(screen.getByText('value2')).toBeInTheDocument();
        });

        it('should return null when no fields to show', () => {
            const fields: FieldDefinition[] = [];
            const values = {};

            const { container } = render(
                <TestWrapper>
                    <RecipeFormRenderer fields={fields} values={values} />
                </TestWrapper>
            );

            // When there are no fields, RecipeFormRenderer returns null
            expect(container.firstChild).toBeNull();
        });
    });

    describe('hidden fields filtering', () => {
        it('should not render hidden fields', () => {
            const fields = [
                createMockField({ key: 'field1', label: 'Field 1' }),
                createMockField({ key: 'field2', label: 'Field 2', hidden: true }),
                createMockField({ key: 'field3', label: 'Field 3' }),
            ];
            const values = { field1: 'value1', field2: 'value2', field3: 'value3' };

            render(
                <TestWrapper>
                    <RecipeFormRenderer fields={fields} values={values} />
                </TestWrapper>
            );

            expect(screen.getByText('Field 1')).toBeInTheDocument();
            expect(screen.queryByText('Field 2')).not.toBeInTheDocument();
            expect(screen.getByText('Field 3')).toBeInTheDocument();
        });

        it('should return null when all fields are hidden', () => {
            const fields = [
                createMockField({ key: 'field1', hidden: true }),
                createMockField({ key: 'field2', hidden: true }),
            ];
            const values = {};

            const { container } = render(
                <TestWrapper>
                    <RecipeFormRenderer fields={fields} values={values} />
                </TestWrapper>
            );

            // When all fields are hidden, RecipeFormRenderer returns null
            expect(container.firstChild).toBeNull();
        });
    });

    describe('collapsed mode', () => {
        it('should only show fields with handles when collapsed', () => {
            const fields = [
                createMockField({ key: 'field1', label: 'Field 1', connection: 'input' }),
                createMockField({ key: 'field2', label: 'Field 2', type: 'string' }),
                createMockField({ key: 'field3', label: 'Field 3', connection: 'output' }),
            ];
            const values = { field1: 'value1', field2: 'value2', field3: 'value3' };

            render(
                <TestWrapper>
                    <RecipeFormRenderer fields={fields} values={values} isCollapsed={true} />
                </TestWrapper>
            );

            expect(screen.getByText('Field 1')).toBeInTheDocument();
            expect(screen.queryByText('Field 2')).not.toBeInTheDocument();
            expect(screen.getByText('Field 3')).toBeInTheDocument();
        });

        it('should show fields with form-input widget when collapsed', () => {
            const fields = [
                createMockField({ key: 'field1', label: 'Field 1', widget: 'form-input' }),
                createMockField({ key: 'field2', label: 'Field 2', type: 'string' }),
            ];
            const values = { field1: 'value1', field2: 'value2' };

            render(
                <TestWrapper>
                    <RecipeFormRenderer fields={fields} values={values} isCollapsed={true} />
                </TestWrapper>
            );

            expect(screen.getByText('Field 1')).toBeInTheDocument();
            expect(screen.queryByText('Field 2')).not.toBeInTheDocument();
        });

        it('should show fields with table-input widget when collapsed', () => {
            const fields = [
                createMockField({ key: 'field1', label: 'Field 1', widget: 'table-input' }),
                createMockField({ key: 'field2', label: 'Field 2', type: 'string' }),
            ];
            const values = { field1: 'value1', field2: 'value2' };

            render(
                <TestWrapper>
                    <RecipeFormRenderer fields={fields} values={values} isCollapsed={true} />
                </TestWrapper>
            );

            expect(screen.getByText('Field 1')).toBeInTheDocument();
            expect(screen.queryByText('Field 2')).not.toBeInTheDocument();
        });

        it('should show object type fields when collapsed', () => {
            const fields = [
                createMockField({ key: 'field1', label: 'Field 1', type: 'object' }),
                createMockField({ key: 'field2', label: 'Field 2', type: 'string' }),
            ];
            const values = { field1: {}, field2: 'value2' };

            render(
                <TestWrapper>
                    <RecipeFormRenderer fields={fields} values={values} isCollapsed={true} />
                </TestWrapper>
            );

            expect(screen.getByText('Field 1')).toBeInTheDocument();
            expect(screen.queryByText('Field 2')).not.toBeInTheDocument();
        });

        it('should show array type fields when collapsed', () => {
            const fields = [
                createMockField({ key: 'field1', label: 'Field 1', type: 'array' }),
                createMockField({ key: 'field2', label: 'Field 2', type: 'string' }),
            ];
            const values = { field1: [], field2: 'value2' };

            render(
                <TestWrapper>
                    <RecipeFormRenderer fields={fields} values={values} isCollapsed={true} />
                </TestWrapper>
            );

            expect(screen.getByText('Field 1')).toBeInTheDocument();
            expect(screen.queryByText('Field 2')).not.toBeInTheDocument();
        });

        it('should not show hidden fields even when collapsed', () => {
            const fields = [
                createMockField({ key: 'field1', label: 'Field 1', connection: 'input' }),
                createMockField({ key: 'field2', label: 'Field 2', connection: 'input', hidden: true }),
            ];
            const values = { field1: 'value1', field2: 'value2' };

            render(
                <TestWrapper>
                    <RecipeFormRenderer fields={fields} values={values} isCollapsed={true} />
                </TestWrapper>
            );

            expect(screen.getByText('Field 1')).toBeInTheDocument();
            expect(screen.queryByText('Field 2')).not.toBeInTheDocument();
        });

        it('should return null when collapsed and no fields with handles', () => {
            const fields = [
                createMockField({ key: 'field1', label: 'Field 1', type: 'string' }),
                createMockField({ key: 'field2', label: 'Field 2', type: 'number' }),
            ];
            const values = { field1: 'value1', field2: 42 };

            const { container } = render(
                <TestWrapper>
                    <RecipeFormRenderer fields={fields} values={values} isCollapsed={true} />
                </TestWrapper>
            );

            // When no fields with handles exist in collapsed mode, RecipeFormRenderer returns null
            expect(container.firstChild).toBeNull();
        });
    });

    describe('onChange handler', () => {
        it('should call onChange with field key when value changes', () => {
            const fields = [createMockField({ key: 'myField', label: 'My Field' })];
            const values = { myField: 'initial' };
            const onChange = vi.fn();

            // Create a widget that triggers onChange
            const widget = createMockWidget({
                id: 'change-widget',
                renderFieldContent: ({ onChange: fieldOnChange }) => (
                    <button onClick={() => fieldOnChange('new value')}>Change</button>
                ),
            });
            widgetRegistry.register(widget);

            const fieldWithWidget = { ...fields[0], widget: 'change-widget' } as FieldDefinition;

            render(
                <TestWrapper>
                    <RecipeFormRenderer fields={[fieldWithWidget]} values={values} onChange={onChange} />
                </TestWrapper>
            );

            const button = screen.getByText('Change');
            button.click();

            expect(onChange).toHaveBeenCalledWith('myField', 'new value');
        });

        it('should work without onChange handler', () => {
            const fields = [createMockField({ key: 'field1', label: 'Field 1' })];
            const values = { field1: 'value1' };

            // Should not throw when onChange is not provided
            expect(() => {
                render(
                    <TestWrapper>
                        <RecipeFormRenderer fields={fields} values={values} />
                    </TestWrapper>
                );
            }).not.toThrow();
        });
    });

    describe('connectedValues prop', () => {
        it('should pass connectedValues to field rows', () => {
            const fields = [createMockField({ key: 'field1', label: 'Field 1' })];
            const values = { field1: 'value1' };
            const connectedValues = { field1: 'connected value' };
            let receivedConnectedValues: any = null;

            const widget = createMockWidget({
                id: 'conn-widget',
                renderFieldContent: ({ connectedValues }) => {
                    receivedConnectedValues = connectedValues;
                    return <div>Content</div>;
                },
            });
            widgetRegistry.register(widget);

            const fieldWithWidget = { ...fields[0], widget: 'conn-widget' } as FieldDefinition;

            render(
                <TestWrapper>
                    <RecipeFormRenderer
                        fields={[fieldWithWidget]}
                        values={values}
                        connectedValues={connectedValues}
                    />
                </TestWrapper>
            );

            expect(receivedConnectedValues).toEqual(connectedValues);
        });
    });
});
