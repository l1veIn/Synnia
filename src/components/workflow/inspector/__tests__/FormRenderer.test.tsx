// @ts-nocheck
/**
 * FormRenderer Tests
 * Tests for the FormRenderer component which renders form fields based on schema
 *
 * @vitest-environment jsdom
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormRenderer } from '../FormRenderer';
import type { FieldDefinition } from '@/types/assets';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

// ============================================================================
// Test Setup
// ============================================================================

// Initialize i18next for testing
const initI18n = async () => {
    await i18next.use(initReactI18next).init({
        lng: 'en',
        fallbackLng: 'en',
        resources: {
            en: {
                inspector: {
                    'formRenderer': {
                        'noFields': 'No fields defined. Switch to Schema tab to build your form.',
                    },
                },
            },
        },
    });
};

beforeEach(async () => {
    await initI18n();
});

// Wrapper component to provide i18n context
const renderWithI18n = (ui: React.ReactElement) => {
    return render(
        <I18nextProvider i18n={i18next}>
            {ui}
        </I18nextProvider>
    );
};

// ============================================================================
// Test Helpers
// ============================================================================

const createField = (overrides: Partial<FieldDefinition> = {}): FieldDefinition => ({
    key: 'testField',
    type: 'string',
    ...overrides,
});

// ============================================================================
// Empty State Tests
// ============================================================================

describe('FormRenderer - Empty State', () => {
    it('should show no fields message when schema is empty', () => {
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={[]}
                values={{}}
                onChange={onChange}
            />
        );

        expect(screen.getByText('No fields defined. Switch to Schema tab to build your form.')).toBeDefined();
    });

    it('should show no fields message when schema is null', () => {
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={null as any}
                values={{}}
                onChange={onChange}
            />
        );

        expect(screen.getByText('No fields defined. Switch to Schema tab to build your form.')).toBeDefined();
    });

    it('should show no fields message when schema is undefined', () => {
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={undefined as any}
                values={{}}
                onChange={onChange}
            />
        );

        expect(screen.getByText('No fields defined. Switch to Schema tab to build your form.')).toBeDefined();
    });
});

// ============================================================================
// Rendering Tests - Basic Fields
// ============================================================================

describe('FormRenderer - Basic Field Rendering', () => {
    it('should render string field with text input', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'name', type: 'string', label: 'Name' }),
        ];
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{}}
                onChange={onChange}
            />
        );

        expect(screen.getByText('Name')).toBeDefined();
        expect(screen.getByRole('textbox')).toBeDefined();
    });

    it('should render number field with number input', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'count', type: 'number', label: 'Count' }),
        ];
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{}}
                onChange={onChange}
            />
        );

        expect(screen.getByText('Count')).toBeDefined();
        const input = screen.getByRole('spinbutton');
        expect(input).toBeDefined();
        expect((input as HTMLInputElement).type).toBe('number');
    });

    it('should render boolean field with switch', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'active', type: 'boolean', label: 'Active' }),
        ];
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{ active: true }}
                onChange={onChange}
            />
        );

        expect(screen.getByText('Active')).toBeDefined();
        expect(screen.getByText('True')).toBeDefined();
    });

    it('should render field label when provided', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'username', type: 'string', label: 'Username' }),
        ];
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{}}
                onChange={onChange}
            />
        );

        expect(screen.getByText('Username')).toBeDefined();
    });

    it('should use field key as fallback label when label not provided', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'emailAddress', type: 'string' }),
        ];
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{}}
                onChange={onChange}
            />
        );

        expect(screen.getByText('emailAddress')).toBeDefined();
    });

    it('should show required asterisk for required fields', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'title', type: 'string', label: 'Title', required: true }),
        ];
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{}}
                onChange={onChange}
            />
        );

        expect(screen.getByText('*')).toBeDefined();
    });
});

// ============================================================================
// Rendering Tests - Hidden Fields
// ============================================================================

describe('FormRenderer - Hidden Fields', () => {
    it('should not render hidden fields', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'visible', type: 'string', label: 'Visible' }),
            createField({ key: 'hidden', type: 'string', label: 'Hidden', hidden: true }),
        ];
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{}}
                onChange={onChange}
            />
        );

        expect(screen.getByText('Visible')).toBeDefined();
        expect(screen.queryByText('Hidden')).toBeNull();
    });

    it('should render only non-hidden fields when multiple fields are hidden', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'field1', type: 'string', label: 'Field 1', hidden: true }),
            createField({ key: 'field2', type: 'string', label: 'Field 2' }),
            createField({ key: 'field3', type: 'string', label: 'Field 3', hidden: true }),
            createField({ key: 'field4', type: 'string', label: 'Field 4' }),
        ];
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{}}
                onChange={onChange}
            />
        );

        expect(screen.queryByText('Field 1')).toBeNull();
        expect(screen.getByText('Field 2')).toBeDefined();
        expect(screen.queryByText('Field 3')).toBeNull();
        expect(screen.getByText('Field 4')).toBeDefined();
    });
});

// ============================================================================
// Value Change Tests
// ============================================================================

describe('FormRenderer - Value Changes', () => {
    it('should call onChange with updated value for text input', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'name', type: 'string', label: 'Name' }),
        ];
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{}}
                onChange={onChange}
            />
        );

        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'John' } });

        expect(onChange).toHaveBeenCalledWith({ name: 'John' });
    });

    it('should call onChange with updated value for number input', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'age', type: 'number', label: 'Age' }),
        ];
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{}}
                onChange={onChange}
            />
        );

        const input = screen.getByRole('spinbutton');
        fireEvent.change(input, { target: { value: '42' } });

        expect(onChange).toHaveBeenCalledWith({ age: 42 });
    });

    it('should call onChange with updated value for boolean switch', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'enabled', type: 'boolean', label: 'Enabled' }),
        ];
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{ enabled: false }}
                onChange={onChange}
            />
        );

        const switchElement = screen.getByRole('switch');
        fireEvent.click(switchElement);

        expect(onChange).toHaveBeenCalledWith({ enabled: true });
    });

    it('should preserve existing values when updating a single field', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'name', type: 'string', label: 'Name' }),
            createField({ key: 'age', type: 'number', label: 'Age' }),
        ];
        const onChange = vi.fn();
        const initialValues = { name: 'John', age: 30 };

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={initialValues}
                onChange={onChange}
            />
        );

        const inputs = screen.getAllByRole('textbox');
        fireEvent.change(inputs[0], { target: { value: 'Jane' } });

        expect(onChange).toHaveBeenCalledWith({ name: 'Jane', age: 30 });
    });
});

// ============================================================================
// Default Value Tests
// ============================================================================

describe('FormRenderer - Default Values', () => {
    it('should use field defaultValue when value is undefined', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'message', type: 'string', label: 'Message', defaultValue: 'Hello' }),
        ];
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{}}
                onChange={onChange}
            />
        );

        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.value).toBe('Hello');
    });

    it('should use field defaultValue when value is null', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'count', type: 'number', label: 'Count', defaultValue: 10 }),
        ];
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{ count: null }}
                onChange={onChange}
            />
        );

        const input = screen.getByRole('spinbutton') as HTMLInputElement;
        expect(input.value).toBe('10');
    });

    it('should use provided value over defaultValue', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'status', type: 'string', label: 'Status', defaultValue: 'pending' }),
        ];
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{ status: 'active' }}
                onChange={onChange}
            />
        );

        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.value).toBe('active');
    });

    it('should use empty string when no value or defaultValue provided', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'text', type: 'string', label: 'Text' }),
        ];
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{}}
                onChange={onChange}
            />
        );

        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.value).toBe('');
    });
});

// ============================================================================
// Config Tests
// ============================================================================

describe('FormRenderer - Field Config', () => {
    it('should apply placeholder from config', () => {
        const schema: FieldDefinition[] = [
            createField({
                key: 'email',
                type: 'string',
                label: 'Email',
                config: { placeholder: 'Enter your email' },
            }),
        ];
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{}}
                onChange={onChange}
            />
        );

        const input = screen.getByPlaceholderText('Enter your email');
        expect(input).toBeDefined();
    });

    it('should apply min attribute from config for number input', () => {
        const schema: FieldDefinition[] = [
            createField({
                key: 'quantity',
                type: 'number',
                label: 'Quantity',
                config: { min: 0 },
            }),
        ];
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{}}
                onChange={onChange}
            />
        );

        const input = screen.getByRole('spinbutton') as HTMLInputElement;
        expect(input.min).toBe('0');
    });

    it('should apply max attribute from config for number input', () => {
        const schema: FieldDefinition[] = [
            createField({
                key: 'quantity',
                type: 'number',
                label: 'Quantity',
                config: { max: 100 },
            }),
        ];
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{}}
                onChange={onChange}
            />
        );

        const input = screen.getByRole('spinbutton') as HTMLInputElement;
        expect(input.max).toBe('100');
    });

    it('should apply step attribute from config for number input', () => {
        const schema: FieldDefinition[] = [
            createField({
                key: 'price',
                type: 'number',
                label: 'Price',
                config: { step: 0.01 },
            }),
        ];
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{}}
                onChange={onChange}
            />
        );

        const input = screen.getByRole('spinbutton') as HTMLInputElement;
        expect(input.step).toBe('0.01');
    });

    it('should apply all number config attributes together', () => {
        const schema: FieldDefinition[] = [
            createField({
                key: 'percentage',
                type: 'number',
                label: 'Percentage',
                config: { min: 0, max: 100, step: 1 },
            }),
        ];
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{}}
                onChange={onChange}
            />
        );

        const input = screen.getByRole('spinbutton') as HTMLInputElement;
        expect(input.min).toBe('0');
        expect(input.max).toBe('100');
        expect(input.step).toBe('1');
    });
});

// ============================================================================
// Linked Fields Tests
// ============================================================================

describe('FormRenderer - Linked Fields', () => {
    it('should display linked field badge when field is linked', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'source', type: 'string', label: 'Source' }),
        ];
        const onChange = vi.fn();
        const linkedFields = new Set(['source']);
        const linkedFieldsInfo = {
            source: { sourceTitle: 'Upstream Node', value: 'linked value' },
        };

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{}}
                onChange={onChange}
                linkedFields={linkedFields}
                linkedFieldsInfo={linkedFieldsInfo}
            />
        );

        // The "Upstream Node" text is rendered inside a span, check for its presence
        expect(screen.getByText((content) => content.includes('Upstream Node'))).toBeDefined();
    });

    it('should use linked value for display when field is linked', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'data', type: 'string', label: 'Data' }),
        ];
        const onChange = vi.fn();
        const linkedFields = new Set(['data']);
        const linkedFieldsInfo = {
            data: { sourceTitle: 'Connected Node', value: 'from connection' },
        };

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{ data: 'local value' }}
                onChange={onChange}
                linkedFields={linkedFields}
                linkedFieldsInfo={linkedFieldsInfo}
            />
        );

        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.value).toBe('from connection');
    });

    it('should disable input for linked fields', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'field', type: 'string', label: 'Field' }),
        ];
        const onChange = vi.fn();
        const linkedFields = new Set(['field']);
        const linkedFieldsInfo = {
            field: { sourceTitle: 'Source Node', value: 'value' },
        };

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{}}
                onChange={onChange}
                linkedFields={linkedFields}
                linkedFieldsInfo={linkedFieldsInfo}
            />
        );

        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.disabled).toBe(true);
    });

    it('should not show link badge when linkedFieldsInfo is missing', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'field', type: 'string', label: 'Field' }),
        ];
        const onChange = vi.fn();
        const linkedFields = new Set(['field']);

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{}}
                onChange={onChange}
                linkedFields={linkedFields}
            />
        );

        expect(screen.queryByText(/linked/i)).toBeNull();
    });

    it('should handle empty linkedFieldsInfo gracefully', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'field', type: 'string', label: 'Field' }),
        ];
        const onChange = vi.fn();
        const linkedFields = new Set(['field']);
        const linkedFieldsInfo = {};

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{}}
                onChange={onChange}
                linkedFields={linkedFields}
                linkedFieldsInfo={linkedFieldsInfo}
            />
        );

        // Should render the field but without link badge
        expect(screen.getByText('Field')).toBeDefined();
        expect(screen.queryByText(/linked/i)).toBeNull();
    });

    it('should use local value when field is not in linkedFields', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'field', type: 'string', label: 'Field' }),
        ];
        const onChange = vi.fn();
        const linkedFields = new Set(['otherField']);
        const linkedFieldsInfo = {
            otherField: { sourceTitle: 'Source', value: 'linked' },
        };

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{ field: 'local value' }}
                onChange={onChange}
                linkedFields={linkedFields}
                linkedFieldsInfo={linkedFieldsInfo}
            />
        );

        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.value).toBe('local value');
    });
});

// ============================================================================
// Widget Tests
// ============================================================================

describe('FormRenderer - Custom Widgets', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render custom widget when specified', () => {
        // This test requires mocking the widget registry
        // For now we just verify the component handles unknown widgets gracefully
        const schema: FieldDefinition[] = [
            createField({
                key: 'custom',
                type: 'string',
                label: 'Custom',
                widget: 'non-existent-widget',
            }),
        ];
        const onChange = vi.fn();

        // Should fall back to default text input when widget not found
        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{}}
                onChange={onChange}
            />
        );

        expect(screen.getByText('Custom')).toBeDefined();
    });

    it('should display False text for unchecked boolean', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'active', type: 'boolean', label: 'Active' }),
        ];
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{ active: false }}
                onChange={onChange}
            />
        );

        expect(screen.getByText('False')).toBeDefined();
    });

    it('should display True text for checked boolean', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'active', type: 'boolean', label: 'Active' }),
        ];
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{ active: true }}
                onChange={onChange}
            />
        );

        expect(screen.getByText('True')).toBeDefined();
    });
});

// ============================================================================
// Multiple Fields Tests
// ============================================================================

describe('FormRenderer - Multiple Fields', () => {
    it('should render all fields in schema', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'name', type: 'string', label: 'Name' }),
            createField({ key: 'age', type: 'number', label: 'Age' }),
            createField({ key: 'active', type: 'boolean', label: 'Active' }),
        ];
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{ name: 'John', age: 30, active: true }}
                onChange={onChange}
            />
        );

        expect(screen.getByText('Name')).toBeDefined();
        expect(screen.getByText('Age')).toBeDefined();
        expect(screen.getByText('Active')).toBeDefined();
    });

    it('should maintain field order from schema', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'field1', type: 'string', label: 'Field 1' }),
            createField({ key: 'field2', type: 'string', label: 'Field 2' }),
            createField({ key: 'field3', type: 'string', label: 'Field 3' }),
        ];
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{}}
                onChange={onChange}
            />
        );

        const fieldTexts = screen.getAllByText(/Field \d/);
        expect(fieldTexts[0].textContent).toBe('Field 1');
        expect(fieldTexts[1].textContent).toBe('Field 2');
        expect(fieldTexts[2].textContent).toBe('Field 3');
    });

    it('should update only the changed field when multiple fields exist', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'field1', type: 'string', label: 'Field 1' }),
            createField({ key: 'field2', type: 'string', label: 'Field 2' }),
            createField({ key: 'field3', type: 'string', label: 'Field 3' }),
        ];
        const onChange = vi.fn();
        const initialValues = { field1: 'value1', field2: 'value2', field3: 'value3' };

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={initialValues}
                onChange={onChange}
            />
        );

        const inputs = screen.getAllByRole('textbox');
        fireEvent.change(inputs[1], { target: { value: 'new value2' } });

        expect(onChange).toHaveBeenCalledWith({
            field1: 'value1',
            field2: 'new value2',
            field3: 'value3',
        });
    });
});

// ============================================================================
// Edge Cases Tests
// ============================================================================

describe('FormRenderer - Edge Cases', () => {
    it('should handle null values gracefully', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'text', type: 'string', label: 'Text' }),
        ];
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{ text: null }}
                onChange={onChange}
            />
        );

        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.value).toBe('');
    });

    it('should handle undefined values gracefully', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'count', type: 'number', label: 'Count' }),
        ];
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{}}
                onChange={onChange}
            />
        );

        const input = screen.getByRole('spinbutton') as HTMLInputElement;
        expect(input.value).toBe('');
    });

    it('should handle zero as valid value', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'count', type: 'number', label: 'Count' }),
        ];
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{ count: 0 }}
                onChange={onChange}
            />
        );

        const input = screen.getByRole('spinbutton') as HTMLInputElement;
        expect(input.value).toBe('0');
    });

    it('should handle false as valid boolean value', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'enabled', type: 'boolean', label: 'Enabled' }),
        ];
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{ enabled: false }}
                onChange={onChange}
            />
        );

        expect(screen.getByText('False')).toBeDefined();
        const switchElement = screen.getByRole('switch');
        expect((switchElement as HTMLButtonElement).getAttribute('aria-checked')).not.toBe('true');
    });

    it('should handle empty string as valid value', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'text', type: 'string', label: 'Text' }),
        ];
        const onChange = vi.fn();

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{ text: '' }}
                onChange={onChange}
            />
        );

        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.value).toBe('');
    });

    it('should handle special characters in values', () => {
        const schema: FieldDefinition[] = [
            createField({ key: 'description', type: 'string', label: 'Description' }),
        ];
        const onChange = vi.fn();
        const specialText = '<script>alert("test")</script>';

        renderWithI18n(
            <FormRenderer
                schema={schema}
                values={{ description: specialText }}
                onChange={onChange}
            />
        );

        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.value).toBe(specialText);
    });
});
