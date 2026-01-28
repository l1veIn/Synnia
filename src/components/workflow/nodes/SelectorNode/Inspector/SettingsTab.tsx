import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { List, ChevronDown, LayoutGrid } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ViewMode } from '../types';
import type { SettingsTabProps } from './types';

export function SettingsTab({ ctx }: SettingsTabProps) {
    const { t } = useTranslation('inspector');
    const {
        draftMode, setDraftMode,
        draftViewMode, setDraftViewMode,
        draftShowSearch, setDraftShowSearch,
        draftShowBulkActions, setDraftShowBulkActions,
        draftFieldMapping, setDraftFieldMapping,
        draftCardLayout, setDraftCardLayout,
        draftSchema,
    } = ctx;

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* View Mode */}
            <div className="space-y-2">
                <Label className="text-xs">{t('selector.viewMode')}</Label>
                <div className="flex gap-1">
                    {(['list', 'combobox', 'card'] as ViewMode[]).map(mode => (
                        <Button
                            key={mode}
                            variant={draftViewMode === mode ? 'secondary' : 'ghost'}
                            size="sm"
                            className="flex-1 h-8 text-xs capitalize"
                            onClick={() => setDraftViewMode(mode)}
                        >
                            {mode === 'list' && <List className="h-3.5 w-3.5 mr-1" />}
                            {mode === 'combobox' && <ChevronDown className="h-3.5 w-3.5 mr-1" />}
                            {mode === 'card' && <LayoutGrid className="h-3.5 w-3.5 mr-1" />}
                            {t(`selector.${mode}`)}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Selection Mode */}
            <div className="space-y-2">
                <Label className="text-xs">{t('selector.selectionMode')}</Label>
                <div className="flex gap-2">
                    <Button
                        variant={draftMode === 'single' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={() => setDraftMode('single')}
                    >
                        {t('selector.single')}
                    </Button>
                    <Button
                        variant={draftMode === 'multi' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={() => setDraftMode('multi')}
                    >
                        {t('selector.multiple')}
                    </Button>
                </div>
            </div>

            {/* UI Toggles */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="text-xs">{t('selector.showSearch')}</Label>
                    <Switch checked={draftShowSearch} onCheckedChange={setDraftShowSearch} />
                </div>
                <div className="flex items-center justify-between">
                    <Label className="text-xs">{t('selector.bulkActions')}</Label>
                    <Switch
                        checked={draftShowBulkActions}
                        onCheckedChange={setDraftShowBulkActions}
                        disabled={draftMode === 'single'}
                    />
                </div>
            </div>

            {/* Field Mapping */}
            <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs font-medium">{t('selector.fieldMapping')}</Label>
                <div className="space-y-2">
                    {(['title', 'subtitle', 'avatar', 'description'] as const).map(role => (
                        <div key={role} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-20 capitalize">{t(`selector.${role}`)}</span>
                            <Select
                                value={draftFieldMapping[role] || '__auto__'}
                                onValueChange={(val) => setDraftFieldMapping(prev => ({
                                    ...prev,
                                    [role]: val === '__auto__' ? undefined : val
                                }))}
                            >
                                <SelectTrigger className="h-7 text-xs flex-1">
                                    <SelectValue placeholder={t('selector.auto')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__auto__">{t('selector.auto')}</SelectItem>
                                    {draftSchema.map(field => (
                                        <SelectItem key={field.key} value={field.key}>
                                            {field.label || field.key}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ))}
                </div>
            </div>

            {/* Card Layout - only when card view is selected */}
            {draftViewMode === 'card' && (
                <div className="space-y-3 pt-2 border-t">
                    <Label className="text-xs font-medium">{t('selector.cardLayout')}</Label>
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">{t('selector.columns')}</span>
                                <span>{draftCardLayout.columns ?? 3}</span>
                            </div>
                            <Slider
                                value={[draftCardLayout.columns ?? 3]}
                                min={1}
                                max={6}
                                step={1}
                                onValueChange={([val]) => setDraftCardLayout(prev => ({ ...prev, columns: val }))}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-20">{t('selector.orientation')}</span>
                            <div className="flex gap-1 flex-1">
                                <Button
                                    variant={draftCardLayout.orientation === 'vertical' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    className="flex-1 h-7 text-[10px]"
                                    onClick={() => setDraftCardLayout(prev => ({ ...prev, orientation: 'vertical' }))}
                                >
                                    {t('selector.vertical')}
                                </Button>
                                <Button
                                    variant={draftCardLayout.orientation === 'horizontal' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    className="flex-1 h-7 text-[10px]"
                                    onClick={() => setDraftCardLayout(prev => ({ ...prev, orientation: 'horizontal' }))}
                                >
                                    {t('selector.horizontal')}
                                </Button>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">{t('selector.showAvatar')}</Label>
                            <Switch
                                checked={draftCardLayout.showAvatar ?? true}
                                onCheckedChange={(val) => setDraftCardLayout(prev => ({ ...prev, showAvatar: val }))}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">{t('selector.showSubtitle')}</Label>
                            <Switch
                                checked={draftCardLayout.showSubtitle ?? true}
                                onCheckedChange={(val) => setDraftCardLayout(prev => ({ ...prev, showSubtitle: val }))}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
