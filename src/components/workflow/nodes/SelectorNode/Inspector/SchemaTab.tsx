import { SchemaBuilder } from '@/components/workflow/inspector/SchemaBuilder';
import type { SchemaTabProps } from './types';

export function SchemaTab({ ctx }: SchemaTabProps) {
    const { draftSchema, setDraftSchema } = ctx;

    return (
        <div className="flex-1 overflow-y-auto p-4">
            <SchemaBuilder
                schema={draftSchema}
                onChange={setDraftSchema}
            />
        </div>
    );
}
