import { PixelCrop } from 'react-image-crop'

export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous') 
    image.src = url
  })

export function getRadianAngle(degreeValue: number) {
  return (degreeValue * Math.PI) / 180
}

/**
 * Returns the new bounding area of a rotated rectangle.
 */
export function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = getRadianAngle(rotation)

  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  }
}

// 核心：在 Canvas 上绘制经过 旋转 + 裁剪 的图片
export async function canvasPreview(
  image: HTMLImageElement,
  canvas: HTMLCanvasElement,
  crop: PixelCrop,
  scale = 1,
  rotate = 0,
) {
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('No 2d context')
  }

  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height
  // devicePixelRatio slightly increases sharpness on retina devices
  // at the cost of slightly slower render times and larger file sizes.
  const pixelRatio = window.devicePixelRatio || 1

  canvas.width = Math.floor(crop.width * scaleX * pixelRatio)
  canvas.height = Math.floor(crop.height * scaleY * pixelRatio)

  ctx.scale(pixelRatio, pixelRatio)
  ctx.imageSmoothingQuality = 'high'

  const cropX = crop.x * scaleX
  const cropY = crop.y * scaleY

  const rotateRads = getRadianAngle(rotate)
  const centerX = image.naturalWidth / 2
  const centerY = image.naturalHeight / 2

  ctx.save()

  // 5) Move the crop origin to the canvas origin (0,0)
  ctx.translate(-cropX, -cropY)
  // 4) Move the origin to the center of the original position
  ctx.translate(centerX, centerY)
  // 3) Rotate around the origin
  ctx.rotate(rotateRads)
  // 2) Scale the image
  ctx.scale(scale, scale)
  // 1) Move the center of the image to the origin (0,0)
  ctx.translate(-centerX, -centerY)
  ctx.drawImage(
    image,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight,
  )

  ctx.restore()
}

// 辅助：生成旋转后的图片 Blob（用于作为 Cropper 的输入源，如果我们需要“固化”旋转）
export async function getRotatedImage(imageSrc: string, rotation = 0): Promise<string> {
    const image = await createImage(imageSrc)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if(!ctx) return imageSrc;

    const rotRad = getRadianAngle(rotation)
    const { width: bBoxWidth, height: bBoxHeight } = rotateSize(image.width, image.height, rotation)

    canvas.width = bBoxWidth
    canvas.height = bBoxHeight

    ctx.translate(bBoxWidth / 2, bBoxHeight / 2)
    ctx.rotate(rotRad)
    ctx.translate(-image.width / 2, -image.height / 2)
    ctx.drawImage(image, 0, 0)

    return canvas.toDataURL('image/png'); // Return Base64
}

// 兼容旧接口，直接返回 Blob

export default async function getCroppedImg(

  imageSrc: string,

  pixelCrop: PixelCrop,

  rotation = 0,

  flip = { horizontal: false, vertical: false } // Flip not implemented in canvasPreview yet

): Promise<Blob | null> {

    const image = await createImage(imageSrc)

    const canvas = document.createElement('canvas')

    

    // 如果没有 crop，或者 crop 是全图，就只做旋转

    const safeCrop = (pixelCrop && pixelCrop.width > 0 && pixelCrop.height > 0) 

        ? pixelCrop 

        : { x: 0, y: 0, width: image.width, height: image.height, unit: 'px' } as PixelCrop;



    await canvasPreview(image, canvas, safeCrop, 1, rotation);



    return new Promise((resolve, reject) => {

        canvas.toBlob((file) => {

            if(file) resolve(file)

            else reject(new Error('Canvas is empty'))

        }, 'image/png')

    })

}



/**

 * Wraps a PNG blob into a simple ICO file format (PNG-in-ICO).

 * Compatible with modern browsers and OSs.

 */

export async function generateIcoBlob(pngBlob: Blob): Promise<Blob> {

    const pngBuffer = await pngBlob.arrayBuffer();

    const pngData = new Uint8Array(pngBuffer);

    

    // Get image dimensions (we need to parse PNG header or pass dimensions)

    // For simplicity, we assume we just created this PNG and we know it, 

    // BUT to be robust, let's just parse the IHDR chunk of the PNG if possible, 

    // OR create an ImageBitmap to get dimensions.

    const imageBitmap = await createImageBitmap(pngBlob);

    const width = imageBitmap.width > 255 ? 0 : imageBitmap.width;

    const height = imageBitmap.height > 255 ? 0 : imageBitmap.height;

    

    const header = new Uint8Array(22); // 6 (IconDir) + 16 (IconDirEntry)

    const view = new DataView(header.buffer);

    

    // ICONDIR

    view.setUint16(0, 0, true); // Reserved

    view.setUint16(2, 1, true); // Type (1=ICO)

    view.setUint16(4, 1, true); // Count (1 image)

    

    // ICONDIRENTRY

    view.setUint8(6, width);  // Width

    view.setUint8(7, height); // Height

    view.setUint8(8, 0);      // ColorCount

    view.setUint8(9, 0);      // Reserved

    view.setUint16(10, 1, true); // Planes

    view.setUint16(12, 32, true); // BitCount

    view.setUint32(14, pngData.length, true); // SizeInBytes

    view.setUint32(18, 22, true); // ImageOffset (6+16)

    

    return new Blob([header, pngData], { type: 'image/x-icon' });

}
