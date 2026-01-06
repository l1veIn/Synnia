// SchemaEditor shared types

import { FieldDefinition } from '@/types/assets';

export interface SchemaEditorProps {
    schema: FieldDefinition[];
    onChange: (schema: FieldDefinition[]) => void;
    title?: string;
    readOnly?: boolean;
}

export interface PanelProps {
    schema: FieldDefinition[];
    onChange: (schema: FieldDefinition[]) => void;
    className?: string;
}
