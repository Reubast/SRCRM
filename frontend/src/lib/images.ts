export const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const MAX_SIDE = 1600

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Не удалось прочитать картинку.'))
    }
    image.src = url
  })
}

function encodeCanvas(canvas: HTMLCanvasElement): string {
  const webp = canvas.toDataURL('image/webp', 0.85)

  if (webp.startsWith('data:image/webp')) {
    return webp
  }

  return canvas.toDataURL('image/jpeg', 0.85)
}

// Сжимает картинку до MAX_SIDE по длинной стороне и возвращает data URL.
export async function compressImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Можно вставлять только картинки.')
  }

  const image = await loadImage(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')

  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))

  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Браузер не смог обработать картинку.')
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  const src = encodeCanvas(canvas)
  const bytes = Math.floor((src.length - src.indexOf(',') - 1) * 0.75)

  if (bytes > MAX_IMAGE_BYTES) {
    throw new Error('Картинка слишком большая даже после сжатия (максимум 2 МБ).')
  }

  return src
}
