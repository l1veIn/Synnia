import React, { useState } from 'react';
import {
    ChevronRight,
    ChevronDown,
    File,
    Folder,
    FolderOpen,
    FileJson,
    FileCode,
    Image as ImageIcon,
    FileText,
    Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FileNode } from '@/domain/recipe/manifest';
import { Button } from "@/presentation/components/ui/button";

interface FileTreeProps {
    nodes: FileNode[];
    selectedPath: string | null;
    onSelect: (node: FileNode) => void;
    onDelete: (node: FileNode) => void;
    basePath?: string; // For recursion tracking
}

const FileIcon = ({ name }: { name: string }) => {
    if (name.endsWith('.json')) return <FileJson className="w-4 h-4 text-yellow-500" />;
    if (name.endsWith('.yaml') || name.endsWith('.yml')) return <FileCode className="w-4 h-4 text-red-400" />;
    if (name.endsWith('.md')) return <FileText className="w-4 h-4 text-blue-400" />;
    if (name.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) return <ImageIcon className="w-4 h-4 text-purple-400" />;
    return <File className="w-4 h-4 text-muted-foreground" />;
};

export const FileTree = ({ nodes, selectedPath, onSelect, onDelete }: FileTreeProps) => {
    return (
        <div className="select-none text-sm">
            {nodes.map((node) => (
                <TreeNode
                    key={node.path}
                    node={node}
                    selectedPath={selectedPath}
                    onSelect={onSelect}
                    onDelete={onDelete}
                />
            ))}
        </div>
    );
};

const TreeNode = ({
    node,
    selectedPath,
    onSelect,
    onDelete
}: {
    node: FileNode,
    selectedPath: string | null,
    onSelect: (node: FileNode) => void,
    onDelete: (node: FileNode) => void
}) => {
    const [isOpen, setIsOpen] = useState(true); // Default open
    const isSelected = selectedPath === node.path;

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (node.is_dir) {
            setIsOpen(!isOpen);
        }
        onSelect(node);
    };

    return (
        <div className="pl-2">
            <div
                className={cn(
                    "flex items-center group py-1 pr-2 rounded-md cursor-pointer transition-colors",
                    isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                )}
                onClick={handleToggle}
            >
                <div className="w-4 h-4 mr-1 flex items-center justify-center shrink-0">
                    {node.is_dir && (
                        isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
                    )}
                </div>

                <div className="mr-2">
                    {node.is_dir ? (
                        isOpen ? <FolderOpen className="w-4 h-4 text-primary/80" /> : <Folder className="w-4 h-4 text-primary/80" />
                    ) : (
                        <FileIcon name={node.name} />
                    )}
                </div>

                <span className="truncate flex-1 font-mono text-xs">{node.name}</span>

                {/* Hover Actions (Delete) - Prevent deleting manifest.yaml */}
                {node.name !== 'manifest.yaml' && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(node);
                        }}
                    >
                        <Trash2 className="w-3 h-3" />
                    </Button>
                )}
            </div>

            {node.is_dir && isOpen && node.children && (
                <div className="border-l border-border/50 ml-2.5">
                    <FileTree
                        nodes={node.children}
                        selectedPath={selectedPath}
                        onSelect={onSelect}
                        onDelete={onDelete}
                    />
                </div>
            )}
        </div>
    );
};
