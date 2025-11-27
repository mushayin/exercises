export async function compressImage(file: File, maxSize = 1000) {
  // create bitmap for efficient decoding
  const imgBitmap = await createImageBitmap(file)
  const width = imgBitmap.width
  const height = imgBitmap.height
  const scale = Math.min(1, maxSize / Math.max(width, height))
  const w = Math.round(width * scale)
  const h = Math.round(height * scale)

  // try OffscreenCanvas first
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas: any = new OffscreenCanvas(w, h)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(imgBitmap, 0, 0, w, h)
    try {
      return await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 })
    } catch (e) {
      // fallthrough to regular canvas
    }
  }

  // fallback to HTMLCanvasElement
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(imgBitmap, 0, 0, w, h)
  return await new Promise<Blob | null>(resolve => canvas.toBlob(b => resolve(b), 'image/jpeg', 0.8))
}
