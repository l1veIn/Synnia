import { cn } from '@/lib/utils';
import { BotMessageRole } from '@/features/bot/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MessageBubbleProps {
    role: BotMessageRole;
    content: string;
    style?: React.CSSProperties;
    customStyle?: boolean;
}

export function MessageBubble({ role, content, style, customStyle }: MessageBubbleProps) {
    const isUser = role === 'user';

    return (
        <div
            className={cn(
                'flex w-full',
                isUser ? 'justify-end' : 'justify-start'
            )}
        >
            <div
                className={cn(
                    'max-w-[85%] shadow-sm transition-all',
                    isUser
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/80 backdrop-blur-sm text-foreground border border-border/50',
                    customStyle && 'shadow-none border-none bg-transparent'
                )}
                style={{
                    padding: 'var(--bot-message-padding)',
                    fontSize: 'var(--bot-font-size)',
                    fontFamily: 'var(--bot-font-family)',
                    borderRadius: 'var(--bot-border-radius)',
                    borderBottomRightRadius: isUser ? '2px' : 'var(--bot-border-radius)',
                    borderBottomLeftRadius: !isUser ? '2px' : 'var(--bot-border-radius)',
                    ...style
                }}
            >
                {customStyle ? (
                    <div className="whitespace-pre-wrap break-words">{content}</div>
                ) : (
                    <div className={cn(
                        "prose prose-sm dark:prose-invert break-words leading-relaxed max-w-none",
                        isUser ? 'prose-headings:text-primary-foreground prose-p:text-primary-foreground prose-strong:text-primary-foreground prose-a:text-primary-foreground/90' : ''
                    )}
                        style={{ fontSize: 'inherit' }}
                    >
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                pre: ({ node, ...props }) => <pre className="overflow-auto w-full my-2 bg-black/10 dark:bg-black/30 rounded-md p-2 text-xs" {...props} />,
                                code: ({ node, ...props }) => <code className="bg-black/10 dark:bg-black/30 rounded px-1 py-0.5 font-mono text-[90%]" {...props} />
                            }}
                        >
                            {content}
                        </ReactMarkdown>
                    </div>
                )}
            </div>
        </div>
    );
}
