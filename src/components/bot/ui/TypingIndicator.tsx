import { motion } from 'framer-motion';

export function TypingIndicator() {
    return (
        <div className="flex items-center space-x-1 p-2">
            {[0, 1, 2].map((dot) => (
                <motion.div
                    key={dot}
                    className="w-2 h-2 bg-primary/60 rounded-full"
                    animate={{
                        y: [0, -6, 0],
                        opacity: [0.6, 1, 0.6],
                    }}
                    transition={{
                        duration: 0.8,
                        repeat: Infinity,
                        delay: dot * 0.2,
                        ease: "easeInOut",
                    }}
                />
            ))}
        </div>
    );
}
