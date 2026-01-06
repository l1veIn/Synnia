import { FieldDefinition } from '@/types/assets';

export interface DataEditorProps {
    data: any;
    schema: FieldDefinition[];
    onChange: (data: any) => void;
    className?: string;
}

export interface ViewProps {
    data: any;
    schema: FieldDefinition[];
    onChange: (data: any) => void;
    /** Navigate to a nested field. fieldType determines which view to show (TableView for 'array', FormView for 'object'). */
    onNavigate: (path: (string | number)[] | string | number, schema: FieldDefinition[], fieldType: 'array' | 'object') => void;
    path: (string | number)[];
}

export interface NavigationItem {
    path: (string | number)[];
    label: string;
    schema: FieldDefinition[];
    type: 'array' | 'object';
}
