import { SynniaNode } from '@/types/project';

// Helper: Sanitize node data for clipboard/duplication (remove transient state)
export const sanitizeNodeForClipboard = (node: SynniaNode): SynniaNode => {
  const { collapsed, originalPosition, ...cleanData } = node.data;

  return {
    ...node,
    draggable: true,
    hidden: false,
    width: undefined,
    height: undefined,
    style: { ...node.style, width: undefined, height: undefined },
    data: {
      ...JSON.parse(JSON.stringify(cleanData)),
      collapsed: false
    }
  } as SynniaNode;
};
