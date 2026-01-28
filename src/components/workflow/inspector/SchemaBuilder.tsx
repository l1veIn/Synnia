// SchemaBuilder - Wrapper for the new SchemaEditor
// Maintains backward compatibility with existing usage

import { FieldDefinition } from '@/types/assets';
import { SchemaEditor } from '@/components/schema-editor';

interface BuilderProps {
    schema: FieldDefinition[];
    onChange: (schema: FieldDefinition[]) => void;
}

export function SchemaBuilder({ schema, onChange }: BuilderProps) {
    return (
        <SchemaEditor
            schema={schema || []}
            onChange={onChange}
        />
    );
}