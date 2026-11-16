import { bounds, insetConvex, insideRegion, presetOutline, regions } from './geometry'
import type { Loop, Point, Preset } from './geometry'
import { cellContours, makeCells } from './cells'
import type { Cell, Portal } from './cells'
import { insetMask } from './mask'
import type { Mask } from './mask'

export type Outline = Preset | Mask
export type Design = {
  outline: Loop[]
  window: Loop[]
  channels: Loop[]
  routes: Point[][]
  width: number
  height: number
  bearing: number
  clearance: number
  mazeThickness: number
  cells: number
  error?: string
}

export const rimWidth = 5
export const outerLayerThickness = 3

function makeRandom(initial: number) {
  let seed = initial >>> 0
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0
    let value = Math.imul(seed ^ seed >>> 15, seed | 1)
    value ^= value + Math.imul(value ^ value >>> 7, value | 61)
    return ((value ^ value >>> 14) >>> 0) / 4294967296
  }
}

function largestComponent(cells: Cell[]) {
  const visited = new Set<Cell>()
  let largest: Cell[] = []
  for (const cell of cells) {
    if (visited.has(cell)) continue
    const component = [cell]
    visited.add(cell)
    for (const current of component) for (const { peer } of current.portals) {
      if (peer && !visited.has(peer.cell)) {
        component.push(peer.cell)
        visited.add(peer.cell)
      }
    }
    if (component.length > largest.length) largest = component
  }
  return largest
}

function buildTree(cells: Cell[], complexity: number, random: () => number) {
  const start = cells[Math.floor(random() * cells.length)]
  const active = [start]
  const seen = new Set(active)
  while (active.length) {
    const index = random() < (complexity + 3) / 9 ? active.length - 1 : Math.floor(random() * active.length)
    const options = active[index].portals.filter(portal => portal.peer && !seen.has(portal.peer.cell))
    if (!options.length) {
      active.splice(index, 1)
      continue
    }
    const portal = options[Math.floor(random() * options.length)]
    const peer = portal.peer!
    portal.open = peer.open = true
    seen.add(peer.cell)
    active.push(peer.cell)
  }
}

function farthest(start: Cell) {
  const queue = [start]
  const parents = new Map<Cell, Portal | null>([[start, null]])
  for (const current of queue) for (const { open, peer } of current.portals) {
    if (open && peer && !parents.has(peer.cell)) {
      parents.set(peer.cell, peer)
      queue.push(peer.cell)
    }
  }
  return { end: queue[queue.length - 1], parents }
}

function longestRoute(start: Cell) {
  const { end, parents } = farthest(farthest(start).end)
  const route = [end.center]
  for (let portal = parents.get(end); portal?.peer; portal = parents.get(portal.peer.cell)) {
    route.push(portal.approach, portal.peer.approach, portal.peer.cell.center)
  }
  return route.filter((point, index) => index === 0
    || Math.hypot(point.x - route[index - 1].x, point.y - route[index - 1].y) > 1e-8)
}

export function generateDesign(outline: Outline, width: number, bearing: number, complexity: number, seed: number, cellShape: Preset = 'Square'): Design {
  const custom = typeof outline !== 'string'
  const scale = (loops: Loop[]) => loops.map(loop => loop.map(({ x, y }) => ({ x: x * width, y: y * width })))
  const outer = scale(custom ? outline.loops : [presetOutline(outline)])
  const window = custom ? scale(insetMask(outline, rimWidth / width)) : insetConvex(outer[0], rimWidth)
  const clearance = bearing + 0.25
  const design: Design = {
    outline: outer, window, width, height: bounds(outer).height, bearing, clearance,
    mazeThickness: Math.ceil(clearance * 2) / 2, channels: [], routes: [], cells: 0,
  }
  const pieces = regions(outer)
  const inserts = regions(window)
  const random = makeRandom(seed)

  for (const piece of pieces) {
    const matching = inserts.filter(insert => insideRegion(piece, insert.outer[0]))
    if (matching.length !== 1) {
      return { ...design, channels: [], routes: [], cells: 0,
        error: 'Each piece needs one continuous window. Widen narrow parts or remove small islands.' }
    }
    const component = largestComponent(makeCells(matching[0], cellShape, clearance, complexity))
    if (component.length < 2) {
      return { ...design, channels: [], routes: [], cells: 0,
        error: 'There is too little room for a route. Increase the board width, reduce the bearing size, or widen the outline.' }
    }
    buildTree(component, complexity, random)
    design.channels.push(...cellContours(component))
    design.routes.push(longestRoute(component[0]))
    design.cells += component.length
  }
  return design
}
