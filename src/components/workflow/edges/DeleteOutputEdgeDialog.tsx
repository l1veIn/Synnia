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
import { useTranslation } from 'react-i18next';

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
    const { t } = useTranslation('common');
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
                    <AlertDialogTitle>{t('dialogs.deleteOutputEdge.title')}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {t('dialogs.deleteOutputEdge.description')}
                        <br />
                        <span className="text-muted-foreground text-xs">
                            {t('dialogs.deleteOutputEdge.note')}
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
                        {t('dialogs.dontAskAgain')}
                    </Label>
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onCancel}>{t('actions.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => onConfirm(dontAskAgain)}
                        className="bg-violet-600 hover:bg-violet-700"
                    >
                        {t('actions.confirm')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
