// SchemaBuilder - Wrapper for the new SchemaEditor
// Maintains backward compatibility with existing usage

import { useState } from 'react';
import { FieldDefinition } from '@/types/assets';
import { Button } from '@/components/ui/button';
import { Maximize2 } from 'lucide-react';
import { InlineSchemaEditor, SchemaEditor } from '@/components/schema-editor';

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