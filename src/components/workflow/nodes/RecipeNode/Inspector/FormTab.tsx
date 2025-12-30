/**
 * FormTab - Wraps the existing FormRenderer for Recipe form editing
 * Part of the new 4-Tab Inspector architecture (Form, Model, Chat, Advanced)
 */

import { FormRenderer } from '../../../inspector/FormRenderer';
import type { RecordAsset, FieldDefinition } from '@/types/assets';

export interface FormTabProps {
    asset: RecordAsset;
    schema: FieldDefinition[];
    values: Record<string, any>;
    onValuesChange: (values: Record<string, any>) => void;
    linkedFields?: Set<string>;
}

export function FormTab({ schema, values, onValuesChange, linkedFields }: FormTabProps) {
    return (
        <div className="form-tab p-2">
            <FormRenderer
                schema={schema}
                values={values}
                onChange={onValuesChange}
                linkedFields={linkedFields}
            />
        </div>
    );
}
