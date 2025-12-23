import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Download, LayoutDashboard } from 'lucide-react'
import { createImage, generateIcoBlob } from '@core/utils/canvas'
import JSZip from 'jszip'; // Import JSZip

interface ImageExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  src: string
}

type ExportFormat = 'png' | 'jpeg' | 'webp' | 'ico';

type SaveFilePickerFn = (options: {
  suggestedName?: string;
  types?: { description?: string; accept: Record<string, string[]> }[];
}) => Promise<{ createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> }>;

// Helper function to save file with File System Access API or fallback
async function saveFileWithPicker(blob: Blob, defaultFilename: string, mimeType: string) {
  const savePicker = (window as unknown as { showSaveFilePicker?: SaveFilePickerFn }).showSaveFilePicker;
  if (savePicker) {
    try {
      const handle = await savePicker({
        suggestedName: defaultFilename,
        types: [{
          description: 'Image File',
          accept: { [mimeType]: ['.' + defaultFilename.split('.').pop()] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err) {
      // User cancelled or other error
      console.error('File picker cancelled or failed:', err);
      return false;
    }
  }
  // Fallback to traditional download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}


export function ImageExportDialog({ open, onOpenChange, src }: ImageExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('png')
  const [filename, setFilename] = useState('image')
  const [quality, setQuality] = useState(90)
  const [isExporting, setIsExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState('');

  // Initialize filename from src if possible
  useEffect(() => {
    if (open && src) {
      setFilename('image');
    }
  }, [open, src])

  const handleDownload = async () => {
    setIsExporting(true);
    setExportStatus('Preparing download...');
    try {
      const image = await createImage(src);
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error('No context');

      ctx.drawImage(image, 0, 0);

      let blob: Blob | null = null;
      let mimeType = `image/${format === 'jpeg' ? 'jpg' : format}`;
      let fileExtension = format === 'jpeg' ? 'jpg' : format;


      if (format === 'ico') {
        // ICO requires PNG data
        const pngBlob = await new Promise<Blob | null>(resolve =>
          canvas.toBlob(resolve, 'image/png')
        );
        if (pngBlob) {
          blob = await generateIcoBlob(pngBlob);
          mimeType = 'image/x-icon';
          fileExtension = 'ico';
        }
      } else {
        blob = await new Promise<Blob | null>(resolve =>
          canvas.toBlob(resolve, mimeType, quality / 100)
        );
      }

      if (blob) {
        await saveFileWithPicker(blob, `${filename}.${fileExtension}`, mimeType);
        onOpenChange(false);
      }
    } catch (e) {
      console.error("Export failed", e);
    } finally {
      setIsExporting(false);
      setExportStatus('');
    }
  };

  const handleGenerateAppIcons = async () => {
    setIsExporting(true);
    setExportStatus('Generating app icons...');
    try {
      const image = await createImage(src);
      const zip = new JSZip();

      const iconSizes = [16, 32, 48, 64, 128, 180, 192, 512]; // Common icon sizes

      // iOS-style corner radius ratio (approximately 22.37% of size)
      const cornerRadiusRatio = 0.2237;

      // Helper function to draw rounded rect path
      const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
      };

      for (const size of iconSizes) {
        setExportStatus(`Resizing to ${size}x${size}...`);
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        if (!ctx) throw new Error('No canvas context for icon generation');

        // Apply rounded corners via clipping
        const cornerRadius = Math.round(size * cornerRadiusRatio);
        drawRoundedRect(ctx, 0, 0, size, size, cornerRadius);
        ctx.clip();

        // Draw image
        ctx.drawImage(image, 0, 0, size, size);

        const pngBlob = await new Promise<Blob | null>(resolve =>
          canvas.toBlob(resolve, 'image/png')
        );

        if (pngBlob) {
          zip.file(`icon-${size}x${size}.png`, pngBlob);
        }
      }

      // Favicon.ico (no rounded corners for favicon - it's too small)
      setExportStatus('Generating favicon.ico...');
      const canvas16 = document.createElement('canvas');
      canvas16.width = 16;
      canvas16.height = 16;
      const ctx16 = canvas16.getContext('2d');
      if (ctx16) {
        ctx16.drawImage(image, 0, 0, 16, 16);
        const pngBlob16 = await new Promise<Blob | null>(resolve => canvas16.toBlob(resolve, 'image/png'));
        if (pngBlob16) {
          const icoBlob = await generateIcoBlob(pngBlob16);
          zip.file('favicon.ico', icoBlob);
        }
      }

      setExportStatus('Compressing to ZIP...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      await saveFileWithPicker(zipBlob, `${filename}-icons.zip`, 'application/zip');

      onOpenChange(false);

    } catch (e) {
      console.error("App icon generation failed", e);
      setExportStatus('Failed');
    } finally {
      setIsExporting(false);
      setExportStatus('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Image</DialogTitle>
          <DialogDescription>
            Choose format and settings to export your image.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="filename" className="text-right">
              Filename
            </Label>
            <Input
              id="filename"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="col-span-3"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="format" className="text-right">
              Format
            </Label>
            <div className="col-span-3">
              <Select value={format} onValueChange={(v: ExportFormat) => setFormat(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="png">PNG</SelectItem>
                  <SelectItem value="jpeg">JPEG</SelectItem>
                  <SelectItem value="webp">WEBP</SelectItem>
                  <SelectItem value="ico">ICO</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {format !== 'png' && format !== 'ico' && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quality" className="text-right">
                Quality
              </Label>
              <div className="col-span-3 flex items-center gap-4">
                <Input
                  id="quality"
                  type="number"
                  min={1}
                  max={100}
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="w-20"
                />
                <span className="text-xs text-muted-foreground text-nowrap">
                  {quality}% (1-100)
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-col sm:space-x-0 space-y-2">
          <div className="flex justify-end w-full space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>Cancel</Button>
            <Button onClick={handleDownload} disabled={isExporting} className="gap-2">
              <Download className="w-4 h-4" />
              {isExporting ? `Downloading (${exportStatus})` : 'Download'}
            </Button>
          </div>
          <div className="w-full">
            <Button variant="secondary" onClick={handleGenerateAppIcons} disabled={isExporting} className="gap-2 w-full">
              <LayoutDashboard className="w-4 h-4" />
              {isExporting ? `Generating Icons (${exportStatus})` : 'Generate App Icons (ZIP)'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
