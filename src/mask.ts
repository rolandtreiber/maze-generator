import { joinLoops } from './geometry'
import type { Loop, Point, Segment } from './geometry'

export type Mask = {
  label: string
  loops: Loop[]
  width: number
  height: number
  distances: Float32Array
}

const maxResolution = 640
const table: [number, number][][] = [
  [], [[0, 3]], [[1, 0]], [[1, 3]], [[2, 1]], [[0, 3], [2, 1]], [[2, 0]], [[2, 3]],
  [[3, 2]], [[0, 2]], [[1, 0], [3, 2]], [[1, 2]], [[3, 1]], [[0, 1]], [[3, 0]], [],
]
const corners = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]
const edgeCorners = [[0, 1], [1, 2], [3, 2], [0, 3]]

function trace(values: ArrayLike<number>, width: number, height: number, level: number) {
  const segments: Segment[] = []
  for (let y = 0; y < height - 1; y++) for (let x = 0; x < width - 1; x++) {
    const index = y * width + x
    const samples = [values[index], values[index + 1], values[index + width + 1], values[index + width]]
    const code = samples.reduce((state, value, bit) => value > level ? state | 1 << bit : state, 0)
    if (code === 0 || code === 15) continue
    const point = (edge: number): Point => {
      const [first, second] = edgeCorners[edge]
      const a = corners[first]
      const b = corners[second]
      const t = (level - samples[first]) / (samples[second] - samples[first])
      // Round shared vertices equally regardless of the marching square that emits them.
      return { x: +(x + a.x + (b.x - a.x) * t).toFixed(8), y: +(y + a.y + (b.y - a.y) * t).toFixed(8) }
    }
    for (const [a, b] of table[code]) segments.push({ a: point(a), b: point(b) })
  }
  return joinLoops(segments)
}

function toNormalized(loops: Loop[], width: number): Loop[] {
  return loops.map(loop => loop.map(({ x, y }) => ({
    x: (x - 0.5) / (width - 2),
    y: (y - 0.5) / (width - 2),
  })))
}

/** The lower envelope of squared distances to sample sites, evaluated at each pixel. */
function distancesToBackground(bits: Uint8Array, width: number, height: number) {
  const horizontal = new Float32Array(bits.length)
  const result = new Float32Array(bits.length)
  const sites = new Int32Array(height)
  const limits = new Float64Array(height + 1)

  for (let y = 0; y < height; y++) {
    const row = y * width
    let distance = 0
    for (let x = 0; x < width; x++) {
      distance = bits[row + x] ? distance + 1 : 0
      horizontal[row + x] = distance ** 2
    }
    distance = 0
    for (let x = width - 1; x >= 0; x--) {
      distance = bits[row + x] ? distance + 1 : 0
      horizontal[row + x] = Math.min(horizontal[row + x], distance ** 2)
    }
  }

  for (let x = 0; x < width; x++) {
    let count = 0
    sites[0] = 0
    limits[0] = -Infinity
    limits[1] = Infinity
    for (let row = 1; row < height; row++) {
      let intersection: number
      do {
        const prev = sites[count]
        intersection = (horizontal[row * width + x] + row ** 2 - horizontal[prev * width + x] - prev ** 2)
          / (2 * (row - prev))
        if (intersection > limits[count]) break
        count--
      } while (count >= 0)
      sites[++count] = row
      limits[count] = intersection
      limits[count + 1] = Infinity
    }
    count = 0
    for (let row = 0; row < height; row++) {
      while (limits[count + 1] < row) count++
      const prev = sites[count]
      result[row * width + x] = Math.sqrt((row - prev) ** 2 + horizontal[prev * width + x])
    }
  }
  return result
}

export function createMask(image: ImageData, label: string): Mask {
  const { width, height, data } = image
  const all = new Uint8Array(width * height)
  let left = width
  let right = -1
  let top = height
  let bottom = -1
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const pixel = y * width + x
    const index = 4 * pixel
    const luminance = 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]
    if ((255 - luminance) * data[index + 3] / 255 < 128) continue
    all[pixel] = 1
    left = Math.min(left, x)
    right = Math.max(right, x)
    top = Math.min(top, y)
    bottom = Math.max(bottom, y)
  }
  if (right <= left || bottom <= top) throw new Error('Draw or import a solid black shape on a white or transparent background.')
  const w = right - left + 3
  const h = bottom - top + 3
  const bits = new Uint8Array(w * h)
  for (let y = top; y <= bottom; y++) {
    bits.set(all.subarray(y * width + left, y * width + right + 1), (y - top + 1) * w + 1)
  }
  return { label, width: w, height: h, loops: toNormalized(trace(bits, w, h, 0.5), w), distances: distancesToBackground(bits, w, h) }
}

export function insetMask(mask: Mask, distance: number): Loop[] {
  // The first foreground pixel center is half a pixel inside the traced outline.
  const threshold = distance * (mask.width - 2) + 0.500001
  return toNormalized(trace(mask.distances, mask.width, mask.height, threshold), mask.width)
}

export async function loadMask(file: File) {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const scale = maxResolution / Math.max(image.naturalWidth, image.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    return createMask(ctx.getImageData(0, 0, canvas.width, canvas.height), file.name)
  } finally {
    URL.revokeObjectURL(url)
  }
}
