/**
 * Prepara uma foto para o Storage: reduz o lado maior para `maxSide` e grava em
 * WebP (JPEG nos navegadores que não codificam WebP, como o Safari). Sem isto, uma
 * foto de celular (4 a 12 MB) ia inteira para o site, e cada visitante baixava o
 * original só para ver uma miniatura.
 *
 * GIF (pode ser animado) e SVG passam como estão. Se a imagem não puder ser lida,
 * ou a conversão não ficar menor, o original segue: o envio nunca falha por causa
 * daqui.
 */

export interface PreparedImage {
  file: Blob
  extension: string
  contentType: string
}

/** Original já pequeno e dentro do limite: não vale recodificar. */
const KEEP_AS_IS_BELOW_BYTES = 350 * 1024

const WEBP = { type: 'image/webp', extension: 'webp', quality: 0.85 } as const
const JPEG = { type: 'image/jpeg', extension: 'jpg', quality: 0.86 } as const

function originalOf(file: File): PreparedImage {
  return {
    file,
    extension: file.name.split('.').pop()?.toLowerCase() || 'jpg',
    contentType: file.type || 'image/jpeg',
  }
}

function encode(canvas: HTMLCanvasElement, format: { type: string; quality: number }) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, format.type, format.quality))
}

export async function prepareImageForUpload(file: File, maxSide: number): Promise<PreparedImage> {
  const original = originalOf(file)
  if (
    !file.type.startsWith('image/') ||
    file.type === 'image/gif' ||
    file.type === 'image/svg+xml'
  ) {
    return original
  }

  const url = URL.createObjectURL(file)
  try {
    // <img> (e não createImageBitmap): desenhar uma <img> respeita a orientação EXIF das fotos de celular.
    const image = new Image()
    image.src = url
    await image.decode()

    const { naturalWidth: width, naturalHeight: height } = image
    const scale = Math.min(1, maxSide / Math.max(width, height))
    if (scale === 1 && file.size <= KEEP_AS_IS_BELOW_BYTES) return original

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const context = canvas.getContext('2d')
    if (!context) return original
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    let format: typeof WEBP | typeof JPEG = WEBP
    let blob = await encode(canvas, WEBP)
    if (blob?.type !== WEBP.type) {
      // Safari não codifica WebP no canvas. JPEG, com fundo branco onde havia transparência.
      context.globalCompositeOperation = 'destination-over'
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      format = JPEG
      blob = await encode(canvas, JPEG)
    }
    if (!blob || blob.type !== format.type) return original
    // Redimensionada: sempre vale. Só recodificada: só se ficou menor.
    if (scale === 1 && blob.size >= file.size) return original

    return { file: blob, extension: format.extension, contentType: format.type }
  } catch {
    // Formato que o navegador não decodifica (ex.: HEIC fora do Safari): envia como está.
    return original
  } finally {
    URL.revokeObjectURL(url)
  }
}
