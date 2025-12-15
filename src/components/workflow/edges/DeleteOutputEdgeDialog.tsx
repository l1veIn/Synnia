/**
 * Delete Output Edge Confirmation Dialog
 * 
 * 确认删除产出连线的弹窗，支持"不再提示"选项。
 */

import { useState, useEffect } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface DeleteOutputEdgeDialogProps {
    open: boolean;
    onConfirm: (dontAskAgain: boolean) => void;
    onCancel: () => void;
}

export function DeleteOutputEdgeDialog({
    open,
    onConfirm,
    onCancel,
}: DeleteOutputEdgeDialogProps) {
    const [dontAskAgain, setDontAskAgain] = useState(false);

    // Reset checkbox when dialog opens
    useEffect(() => {
        if (open) {
            setDontAskAgain(false);
        }
    }, [open]);

    return (
        <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>解除产出关联</AlertDialogTitle>
                    <AlertDialogDescription>
                        确定要解除该节点与配方的产出关联吗？
                        <br />
                        <span className="text-muted-foreground text-xs">
                            节点本身不会被删除，仅移除产出连线。
                        </span>
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="flex items-center space-x-2 py-2">
                    <Checkbox
                        id="dont-ask-again"
                        checked={dontAskAgain}
                        onCheckedChange={(checked: boolean | 'indeterminate') => setDontAskAgain(checked === true)}
                    />
                    <Label
                        htmlFor="dont-ask-again"
                        className="text-sm text-muted-foreground cursor-pointer"
                    >
                        不再提示
                    </Label>
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onCancel}>取消</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => onConfirm(dontAskAgain)}
                        className="bg-violet-600 hover:bg-violet-700"
                    >
                        确定
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
