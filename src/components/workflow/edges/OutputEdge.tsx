/**
 * Output Edge - 配方产出连线
 * 
 * 虚线紫色样式，表示配方和产物节点的关联。
 * 删除时可以询问用户确认。
 */

import React, { useState, useCallback } from 'react';
import {
    BaseEdge,
    EdgeLabelRenderer,
    getBezierPath,
    useReactFlow,
    EdgeProps,
} from '@xyflow/react';
import { X } from 'lucide-react';
import { graphEngine } from '@/lib/engine/GraphEngine';
import { DeleteOutputEdgeDialog } from './DeleteOutputEdgeDialog';

const SKIP_CONFIRM_KEY = 'synnia:skipOutputEdgeDeleteConfirm';

export default function OutputEdge({
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    selected,
}: EdgeProps) {
    const { deleteElements } = useReactFlow();
    const [isHovered, setIsHovered] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    // Handle delete click
    const onDeleteClick = useCallback((evt: React.MouseEvent) => {
        evt.stopPropagation();

        // Check if user wants to skip confirmation
        const skipConfirm = localStorage.getItem(SKIP_CONFIRM_KEY) === 'true';

        if (skipConfirm) {
            performDelete();
        } else {
            setShowConfirmDialog(true);
        }
    }, []);

    // Perform the actual deletion
    const performDelete = useCallback(() => {
        // 1. Delete the edge
        deleteElements({ edges: [{ id }] });

        // 2. Clear hasProductHandle on target node
        graphEngine.updateNode(target, {
            data: { hasProductHandle: false }
        });
    }, [id, target, deleteElements]);

    // Handle confirm dialog
    const handleConfirm = useCallback((dontAskAgain: boolean) => {
        if (dontAskAgain) {
            localStorage.setItem(SKIP_CONFIRM_KEY, 'true');
        }
        performDelete();
        setShowConfirmDialog(false);
    }, [performDelete]);

    const handleCancel = useCallback(() => {
        setShowConfirmDialog(false);
    }, []);

    return (
        <>
            {/* Dashed purple edge */}
            <BaseEdge
                path={edgePath}
                markerEnd={markerEnd}
                style={{
                    ...style,
                    stroke: selected || isHovered ? '#a855f7' : '#8b5cf6', // Purple
                    strokeWidth: selected || isHovered ? 2.5 : 2,
                    strokeDasharray: '8 4', // Dashed line
                    transition: 'stroke 0.2s, stroke-width 0.2s',
                }}
            />

            {/* Invisible wider path for easier interaction */}
            <path
                d={edgePath}
                fill="none"
                strokeOpacity={0}
                strokeWidth={30}
                className="react-flow__edge-interaction"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                style={{ cursor: 'pointer' }}
            />

            {/* Delete button */}
            <EdgeLabelRenderer>
                <div
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        pointerEvents: 'all',
                        opacity: isHovered || selected ? 1 : 0,
                        transition: 'opacity 0.2s',
                        zIndex: 10,
                    }}
                    className="nodrag nopan"
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    <button
                        className="w-6 h-6 bg-violet-500 text-white rounded-full flex items-center justify-center cursor-pointer shadow-md hover:scale-110 hover:bg-violet-600 transition-all"
                        onClick={onDeleteClick}
                        title="Remove product relationship"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </EdgeLabelRenderer>

            {/* Confirmation Dialog */}
            <DeleteOutputEdgeDialog
                open={showConfirmDialog}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />
        </>
    );
}
