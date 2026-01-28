import { FieldDefinition } from '@/types/assets';
import { SelectorOption, ViewMode, FieldMapping, CardLayoutConfig } from '../types';

/**
 * Common props for selector inspector tabs
 */
export interface SelectorInspectorContext {
    // Asset data
    options: SelectorOption[];
    schema: FieldDefinition[];

    // Draft settings state
    draftMode: 'single' | 'multi';
    setDraftMode: (mode: 'single' | 'multi') => void;
    draftViewMode: ViewMode;
    setDraftViewMode: (mode: ViewMode) => void;
    draftShowSearch: boolean;
    setDraftShowSearch: (show: boolean) => void;
    draftShowBulkActions: boolean;
    setDraftShowBulkActions: (show: boolean) => void;
    draftFieldMapping: Partial<FieldMapping>;
    setDraftFieldMapping: React.Dispatch<React.SetStateAction<Partial<FieldMapping>>>;
    draftCardLayout: Partial<CardLayoutConfig>;
    setDraftCardLayout: React.Dispatch<React.SetStateAction<Partial<CardLayoutConfig>>>;
    draftSchema: FieldDefinition[];
    setDraftSchema: (schema: FieldDefinition[]) => void;

    // Actions
    setValue: (value: any) => void;
    updateConfig: (config: any) => void;

    // Option editing
    onAddOption: () => void;
    onEditOption: (optionId: string) => void;
    onDeleteOption: (optionId: string) => void;
    getOptionLabel: (option: SelectorOption) => string;
}

export interface OptionsTabProps {
    ctx: SelectorInspectorContext;
}

export interface SchemaTabProps {
    ctx: SelectorInspectorContext;
}

export interface SettingsTabProps {
    ctx: SelectorInspectorContext;
}
