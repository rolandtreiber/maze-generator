import { bounds, insideRegion, insetConvex, joinLoops } from './geometry'
import type { Loop, Point, Preset, Region, Segment } from './geometry'

type Pair = [number, number]
type Pattern = {
  tiles: Pair[][]
  step: Pair
  axes: Pair
  stagger: number
}

const hexAxes: Pair = [Math.sqrt(3) / 2, 0.5]

const patterns: Record<Preset, Pattern> = {
  Square: { tiles: [[[0, 0], [1, 0], [1, 1], [0, 1]]], step: [1, 1], axes: [1, 1], stagger: 0 },
  Triangle: {
    tiles: [[[0, 0], [2, 0], [1, 1]], [[2, 0], [3, 1], [1, 1]]],
    step: [2, 1], axes: [1, Math.sqrt(3)], stagger: 1,
  },
  Hexagon: {
    tiles: [[[0, -2], [1, -1], [1, 1], [0, 2], [-1, 1], [-1, -1]]],
    step: [2, 3], axes: hexAxes, stagger: 1,
  },
  Pentagon: {
    // Split each elongated hexagon across the midpoints of its parallel sides.
    // The staggered rows align both halves with the same splits on neighboring hexagons.
    tiles: [[[0, -3], [1, -2], [1, 0], [-1, 0], [-1, -2]], [[1, 0], [1, 2], [0, 3], [-1, 2], [-1, 0]]],
    step: [2, 5], axes: hexAxes, stagger: 1,
  },
}

export type Cell = { center: Point; outline: Loop; portals: Portal[] }
export type Portal = { cell: Cell; edge: number; approach: Point; peer?: Portal; open?: boolean }

const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y
const subtract = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y })
const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y })
const multiply = (p: Point, scalar: number): Point => ({ x: p.x * scalar, y: p.y * scalar })

function faces(loop: Loop) {
  return loop.map((point, i) => {
    const delta = subtract(loop[(i + 1) % loop.length], point)
    const tangent = multiply(delta, 1 / Math.hypot(delta.x, delta.y))
    return { point, normal: { x: -tangent.y, y: tangent.x }, middle: add(point, multiply(delta, 0.5)) }
  })
}

const minimumWall = 1.8
const glueLedge = 2

function minimumScale(loop: Loop, center: Point, radius: number) {
  const sides = faces(loop)
  const halfWall = minimumWall / 2
  let minimum = 0
  for (const face of sides) {
    const centerDistance = dot(subtract(center, face.point), face.normal)
    minimum = Math.max(minimum, (radius + halfWall) / centerDistance)
    for (const other of sides) {
      if (face === other) continue
      // The bearing must fit against every other face throughout its straight approach to the door.
      const distance = dot(subtract(face.middle, other.point), other.normal)
      const alignment = dot(face.normal, other.normal)
      const needed = radius + halfWall * (1 - alignment) - radius * Math.min(0, alignment)
      minimum = Math.max(minimum, needed / distance)
    }
  }
  return minimum
}

function segmentIntersects(a: Point, b: Point, planes: { normal: Point; constant: number }[], offset: Point) {
  let enter = 0
  let exit = 1
  for (const { normal, constant } of planes) {
    const from = dot(normal, a) - dot(normal, offset) - constant
    const to = dot(normal, b) - dot(normal, offset) - constant
    if (from < 0 && to < 0) return false
    if (from < 0) enter = Math.max(enter, from / (from - to))
    if (to < 0) exit = Math.min(exit, from / (from - to))
    if (enter > exit) return false
  }
  return true
}

function edgeKey(a: Pair, b: Pair, x: number, y: number) {
  const [first, last] = a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]) ? [a, b] : [b, a]
  return `${first[0] + x},${first[1] + y}:${last[0] + x},${last[1] + y}`
}

export function makeCells(region: Region, shape: Preset, clearance: number, complexity: number): Cell[] {
  const pattern = patterns[shape]
  const [unitX, unitY] = pattern.axes
  const [stepX, stepY] = pattern.step
  const frame = bounds([region.outer])
  const radius = clearance / 2
  const step = Math.min(stepX * unitX, stepY * unitY)
  const raw = pattern.tiles.map(tile => {
    const points = tile.map(([x, y]) => ({ x: x * unitX, y: y * unitY }))
    const center = multiply(points.reduce(add), 1 / points.length)
    return { tile, points, center }
  })
  const scale = Math.max(
    ...raw.map(({ points, center }) => minimumScale(points, center, radius) * (1 + (5 - complexity) * 0.15)),
    Math.max(frame.width, frame.height) / (72 * step),
  )
  // Change the spacing of square corridors without widening the corridors themselves.
  const wallInset = shape === 'Square' ? (scale - clearance) / 2 : minimumWall / 2
  const templates = raw.map(({ tile, points, center }) => {
    const exterior = points.map(point => multiply(point, scale))
    const [outline] = insetConvex(exterior, wallInset)
    const [margin] = insetConvex(exterior, -glueLedge)
    const extent = bounds([margin])
    const planes = faces(margin).map(({ point, normal }) => ({ normal, constant: dot(normal, point) }))
    const approaches = faces(exterior).map(({ middle, normal }) => add(middle, multiply(normal, wallInset + radius)))
    return { tile, outline, extent, planes, approaches, center: multiply(center, scale) }
  })
  const boundary = [region.outer, ...region.holes].flatMap(loop => loop.map((a, i) => {
    const b = loop[(i + 1) % loop.length]
    return { a, b, left: Math.min(a.x, b.x), right: Math.max(a.x, b.x), top: Math.min(a.y, b.y), bottom: Math.max(a.y, b.y) }
  }))

  const origin = { x: (frame.left + frame.right) / 2, y: (frame.top + frame.bottom) / 2 }
  const columns = Math.ceil(frame.width / (2 * stepX * unitX * scale)) + 1
  const rows = Math.ceil(frame.height / (2 * stepY * unitY * scale)) + 1
  const edges = new Map<string, Portal>()
  const cells: Cell[] = []

  for (let row = -rows; row <= rows; row++) for (let column = -columns; column <= columns; column++) {
    const x = column * stepX + Math.abs(row % 2) * pattern.stagger
    const y = row * stepY
    const offset = add(origin, { x: x * unitX * scale, y: y * unitY * scale })

    for (const template of templates) {
      const center = add(template.center, offset)
      if (!insideRegion(region, center)) continue
      const { extent, planes } = template
      if (boundary.some(edge =>
        edge.right >= extent.left + offset.x && edge.left <= extent.right + offset.x
        && edge.bottom >= extent.top + offset.y && edge.top <= extent.bottom + offset.y
        && segmentIntersects(edge.a, edge.b, planes, offset)
      )) continue

      const cell: Cell = { center, outline: template.outline.map(point => add(point, offset)), portals: [] }
      for (const [i, approach] of template.approaches.entries()) {
        const portal: Portal = { cell, edge: i, approach: add(approach, offset) }
        const key = edgeKey(template.tile[i], template.tile[(i + 1) % template.tile.length], x, y)
        const peer = edges.get(key)
        if (peer) {
          peer.peer = portal
          portal.peer = peer
          edges.delete(key)
        } else {
          edges.set(key, portal)
        }
        cell.portals.push(portal)
      }
      cells.push(cell)
    }
  }
  return cells
}

/** Remove the entire open edge and carry both side walls through to the neighboring cell. */
export function cellContours(cells: Cell[]): Loop[] {
  const segments: Segment[] = []
  for (const { outline, portals } of cells) {
    for (const { edge, open, peer } of portals) {
      const a = outline[edge]
      if (open && peer) {
        const next = peer.cell.outline
        segments.push({ a, b: next[(peer.edge + 1) % next.length] })
      } else {
        segments.push({ a, b: outline[(edge + 1) % outline.length] })
      }
    }
  }
  return joinLoops(segments)
}
