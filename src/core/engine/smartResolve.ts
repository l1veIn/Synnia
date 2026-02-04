/**
 * Smart Resolve - Unified Data Resolution Logic
 *
 * @deprecated This file is a backward compatibility re-export layer.
 * Use @/domain/edge/ValueMappingService instead for new code.
 *
 * TEP Crystallized Principle: "能提取 = 能连接"
 *
 * This module provides unified logic for:
 * 1. Connection validation (canConnect)
 * 2. Runtime data extraction (getMergedInputValues)
 */

export {
    isRequiredSatisfied,
    isTypeMatch,
    smartResolve,
    smartResolveValue,
    smartResolveError,
} from '@/domain/edge/ValueMappingService';

export type { SmartResolveResult } from '@/domain/edge/ValueMappingService';
