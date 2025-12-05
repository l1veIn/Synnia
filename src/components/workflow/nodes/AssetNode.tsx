import { useState, useCallback } from 'react';
import { BaseNodeFrame, BaseNodeFrameProps } from './base-node-frame';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export function AssetNode(props: BaseNodeFrameProps) {
  // 这里暂时用本地 state 模拟，后面会接入 Store
  const [content, setContent] = useState(props.data.content as string || '');
  const [assetType, setAssetType] = useState(props.data.assetType as string || 'text');

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setContent(e.target.value);
    // TODO: updateNodeData(id, { content: e.target.value })
  }, []);

  return (
    <BaseNodeFrame {...props}>
      <div className="flex flex-col gap-3">
        {/* 类型选择器 (简化版) */}
        <div className="flex gap-2 text-xs">
           <span 
             className={`cursor-pointer px-2 py-1 rounded ${assetType === 'text' ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground'}`}
             onClick={() => setAssetType('text')}
           >
             Text
           </span>
           <span 
             className={`cursor-pointer px-2 py-1 rounded ${assetType === 'image' ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground'}`}
             onClick={() => setAssetType('image')}
           >
             Image
           </span>
        </div>

        {/* 内容区域 */}
        {assetType === 'text' ? (
          <div className="grid w-full gap-1.5">
            <Label htmlFor={`text-${props.id}`} className="text-xs text-muted-foreground">Content</Label>
            <Textarea 
              id={`text-${props.id}`} 
              placeholder="Enter text asset..." 
              value={content}
              onChange={handleChange}
              className="text-xs resize-y min-h-[60px] nodrag" // nodrag 很重要，否则无法选中文本
            />
          </div>
        ) : (
          <div className="grid w-full gap-1.5">
            <Label htmlFor={`url-${props.id}`} className="text-xs text-muted-foreground">Image URL</Label>
            <Input 
              id={`url-${props.id}`} 
              placeholder="https://..." 
              value={content}
              onChange={handleChange}
              className="text-xs nodrag"
            />
            {content && (
              <div className="mt-2 rounded-md overflow-hidden border bg-muted aspect-video relative">
                <img src={content} alt="Asset Preview" className="object-cover w-full h-full" />
              </div>
            )}
          </div>
        )}
      </div>
    </BaseNodeFrame>
  );
}
