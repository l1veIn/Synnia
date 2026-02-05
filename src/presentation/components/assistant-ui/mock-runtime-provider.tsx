"use client";

import { AssistantRuntimeProvider, useLocalRuntime } from "@assistant-ui/react";
import type { ReactNode } from "react";

const mockAdapter = {
    async *run({ messages }: { messages: readonly any[] }) {
        const lastMessage = messages[messages.length - 1];
        const text = lastMessage.content[0]?.text || "";

        yield {
            content: [
                {
                    type: "text",
                    text: `Echo: ${text}`,
                } as const,
            ],
        };
    },
};

export function MockRuntimeProvider({
    children,
}: {
    children: ReactNode;
}) {
    const runtime = useLocalRuntime(mockAdapter);

    return (
        <AssistantRuntimeProvider runtime={runtime}>
            {children}
        </AssistantRuntimeProvider>
    );
}
