export type Point = { x: number; y: number }
export type Loop = Point[]
export type Region = { outer: Loop; holes: Loop[] }
export type Preset = 'Hexagon' | 'Pentagon' | 'Square' | 'Triangle'

export function bounds(loops: Loop[]) {
  let left = Infinity
  let right = -Infinity
  let top = Infinity
  let bottom = -Infinity
  for (const loop of loops) for (const { x, y } of loop) {
    left = Math.min(left, x)
    right = Math.max(right, x)
    top = Math.min(top, y)
    bottom = Math.max(bottom, y)
  }
  return { left, right, top, bottom, width: right - left, height: bottom - top }
}

export function area(loop: Loop) {
  return loop.reduce((sum, point, index) => {
    const next = loop[(index + 1) % loop.length]
    return sum + point.x * next.y - next.x * point.y
  }, 0) / 2
}

export function contains(loop: Loop, { x, y }: Point) {
  let inside = false
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i]
    const b = loop[j]
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

export function regions(loops: Loop[]): Region[] {
  const pieces = loops.filter(loop => area(loop) > 0).map(outer => ({ outer, holes: [] as Loop[] }))
  pieces.sort((a, b) => area(a.outer) - area(b.outer))
  for (const hole of loops.filter(loop => area(loop) < 0)) {
    pieces.find(piece => contains(piece.outer, hole[0]))?.holes.push(hole)
  }
  return pieces
}

export function insideRegion(region: Region, point: Point) {
  return contains(region.outer, point) && !region.holes.some(hole => contains(hole, point))
}

export function presetOutline(preset: Preset): Loop {
  if (preset === 'Square') return [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]
  const sides = { Hexagon: 6, Pentagon: 5, Triangle: 3 }[preset]
  const start = preset === 'Hexagon' ? 0 : -Math.PI / 2
  const loop = Array.from({ length: sides }, (_, index) => {
    const angle = start + 2 * Math.PI * index / sides
    return { x: Math.cos(angle), y: Math.sin(angle) }
  })
  const { left, top, width } = bounds([loop])
  return loop.map(({ x, y }) => ({ x: (x - left) / width, y: (y - top) / width }))
}

/** Intersect adjacent inward-offset lines of a clockwise convex polygon. */
export function insetConvex(loop: Loop, distance: number): Loop[] {
  const lines = loop.map((point, index) => {
    const next = loop[(index + 1) % loop.length]
    const length = Math.hypot(next.x - point.x, next.y - point.y)
    const x = (point.y - next.y) / length
    const y = (next.x - point.x) / length
    return { x, y, constant: x * point.x + y * point.y + distance }
  })
  const inset = lines.map((b, index) => {
    const a = lines[(index + lines.length - 1) % lines.length]
    const cross = a.x * b.y - a.y * b.x
    return {
      x: (a.constant * b.y - a.y * b.constant) / cross,
      y: (a.x * b.constant - a.constant * b.x) / cross,
    }
  })
  return inset.every(point => lines.every(line => point.x * line.x + point.y * line.y >= line.constant - 1e-8))
    && area(inset) > 1e-8 ? [inset] : []
}

export type Segment = { a: Point; b: Point }

export function joinLoops(segments: Segment[]): Loop[] {
  const key = ({ x, y }: Point) => `${x},${y}`
  const edges = new Map(segments.map(edge => [key(edge.a), edge.b]))
  const loops: Loop[] = []
  for (const { a } of segments) {
    const start = key(a)
    if (!edges.has(start)) continue
    const loop = [a]
    let current = start
    while (edges.has(current)) {
      const next = edges.get(current)!
      edges.delete(current)
      current = key(next)
      if (current === start) break
      loop.push(next)
    }
    if (current === start && loop.length >= 3) {
      loops.push(loop.filter((point, index) => {
        const prev = loop[(index + loop.length - 1) % loop.length]
        const next = loop[(index + 1) % loop.length]
        return Math.abs((point.x - prev.x) * (next.y - point.y) - (point.y - prev.y) * (next.x - point.x)) > 1e-10
      }))
    }
  }
  return loops
}

export const number = (value: number) => Number(value.toFixed(5))

export function linePath(points: Point[], closed = false) {
  if (!points.length) return ''
  return `M${points.map(({ x, y }) => `${number(x)},${number(y)}`).join('L')}${closed ? 'Z' : ''}`
}

export const loopsPath = (loops: Loop[]) => loops.map(loop => linePath(loop, true)).join('')
