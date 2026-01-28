import { cn } from '@/lib/utils';

interface HighlightedTextProps {
    text: string;
    query: string;
    className?: string;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * HighlightedText - Highlights matching query text
 */
export function HighlightedText({ text, query, className }: HighlightedTextProps) {
    if (!query.trim() || !text) {
        return <span className={className}>{text}</span>;
    }

    const escapedQuery = escapeRegex(query);
    const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));

    return (
        <span className={className}>
            {parts.map((part, i) =>
                part.toLowerCase() === query.toLowerCase() ? (
                    <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded-sm px-0.5">
                        {part}
                    </mark>
                ) : (
                    part
                )
            )}
        </span>
    );
}
