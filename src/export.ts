import { bounds, linePath, loopsPath, number } from './geometry'
import type { Point } from './geometry'
import type { Design } from './maze'

export type FileKind = 'maze' | 'wood' | 'acrylic' | 'solution'
type Sheet = { width: number; height: number }
export type Placement = { x: number; y: number; rotated: boolean }

export const cutFiles: { id: FileKind; name: string; filename: string; material: string }[] = [
  { id: 'maze', name: 'Maze layer', filename: 'maze-layer.svg', material: 'Wood · Middle layer' },
  { id: 'wood', name: 'Base & rim', filename: 'base-and-rim.svg', material: 'Wood · Shared cut' },
  { id: 'acrylic', name: 'Acrylic window', filename: 'acrylic-window.svg', material: 'Acrylic · Top insert' },
  { id: 'solution', name: 'Solution guide', filename: 'solutions.svg', material: 'Reference · Route map' },
]

export function placeOnSheet(design: Design, sheet: Sheet): Placement | null {
  const { width, height, left, top, bottom } = bounds(design.outline)
  const fits = (w: number, h: number) => w <= sheet.width + 1e-8 && h <= sheet.height + 1e-8
  if (fits(width, height)) return { x: (sheet.width - width) / 2 - left, y: (sheet.height - height) / 2 - top, rotated: false }
  if (fits(height, width)) return { x: (sheet.width - height) / 2 + bottom, y: (sheet.height - width) / 2 - left, rotated: true }
  return null
}

type Marker = { point: Point; letter: 'S' | 'F' }

export function markers(design: Design): Marker[] {
  return design.routes.flatMap(route => [
    { point: route[0], letter: 'S' },
    { point: route[route.length - 1], letter: 'F' },
  ])
}

export function markerArtwork(design: Design) {
  const radius = number(design.clearance * 0.37)
  const glyphScale = number(radius * 0.73)
  const glyphs = {
    S: 'M.52,-.54C.29,-.85 -.56,-.85 -.56,-.25C-.56,.17 .57,-.17 .57,.32C.57,.84 -.34,.89 -.62,.54',
    F: 'M-.43,.72V-.72H.52M-.43,-.05H.36',
  }
  return markers(design).map(({ point, letter }) =>
    `<g aria-label="${letter}" transform="translate(${number(point.x)} ${number(point.y)})"><circle r="${radius}" fill="#277246"/><path d="${glyphs[letter]}" transform="scale(${glyphScale})" fill="none" stroke="#fff" stroke-width=".24" stroke-linecap="round" stroke-linejoin="round"/></g>`).join('')
}

export function cutContour(design: Design, file: FileKind) {
  if (file === 'acrylic') return loopsPath(design.window)
  if (file === 'maze') return loopsPath([...design.channels, ...design.outline])
  if (file === 'wood') return loopsPath([...design.window, ...design.outline])
  return ''
}

export function makeSvg(design: Design, sheet: Sheet, placement: Placement, file: FileKind) {
  const title = cutFiles.find(item => item.id === file)!.name.replace('&', '&amp;')
  const transform = `translate(${number(placement.x)} ${number(placement.y)})${placement.rotated ? ' rotate(90)' : ''}`
  const stroke = 'fill="none" stroke="#000000" stroke-width="1px" vector-effect="non-scaling-stroke"'
  const drawing = file === 'solution'
    ? design.routes.map(route => `<path d="${linePath(route)}" ${stroke} stroke-linecap="round" stroke-linejoin="round"/>`).join('\n    ')
    : `${file === 'wood' ? `<g id="start-and-finish">${markerArtwork(design)}</g>\n    ` : ''}<path id="cut-lines" d="${cutContour(design, file)}" ${stroke}/>`
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${sheet.width}mm" height="${sheet.height}mm" viewBox="0 0 ${sheet.width} ${sheet.height}">
  <title>${title}</title>
  <g transform="${transform}">
    ${drawing}
  </g>
</svg>
`
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
