import { motion } from 'framer-motion';
import { Sparkles, Bot, Command, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WelcomeScreenProps {
    onQuickAction: (text: string) => void;
}

export function WelcomeScreen({ onQuickAction }: WelcomeScreenProps) {
    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { y: 20, opacity: 0 },
        show: { y: 0, opacity: 1 }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-8">
            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="flex flex-col items-center max-w-sm"
            >
                <motion.div variants={item} className="mb-6 relative">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <Bot className="w-8 h-8 text-primary" />
                    </div>
                    <Sparkles className="w-4 h-4 text-amber-400 absolute -top-1 -right-1 animate-pulse" />
                </motion.div>

                <motion.h2 variants={item} className="text-2xl font-semibold tracking-tight mb-2">
                    How can I help you today?
                </motion.h2>

                <motion.p variants={item} className="text-muted-foreground text-sm leading-relaxed mb-8">
                    I can help you manage your nodes, generate assets, or answer questions about your canvas.
                </motion.p>

                <motion.div variants={item} className="grid grid-cols-1 w-full gap-2">
                    <Button
                        variant="outline"
                        className="justify-start h-auto py-3 px-4 bg-background/50 hover:bg-muted/80 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-all group"
                        onClick={() => onQuickAction("List all nodes in the canvas")}
                    >
                        <Command className="w-4 h-4 mr-3 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-sm">List all nodes</span>
                    </Button>

                    <Button
                        variant="outline"
                        className="justify-start h-auto py-3 px-4 bg-background/50 hover:bg-muted/80 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-all group"
                        onClick={() => onQuickAction("Create a new note node")}
                    >
                        <Zap className="w-4 h-4 mr-3 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-sm">Create a note</span>
                    </Button>
                </motion.div>
            </motion.div>
        </div>
    );
}
