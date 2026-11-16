import { useEffect, useRef, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import { Box, Crosshair, Hand, Minus, Plus, Route, ScanLine, TriangleAlert } from 'lucide-react'
import { bounds, linePath, loopsPath } from './geometry'
import type { Loop, Point } from './geometry'
import { markers } from './export'
import { outerLayerThickness } from './maze'
import type { Design } from './maze'

const startCamera = { zoom: 1, x: 0, y: 0, angle: -0.32, tilt: 0.8 }
const limitZoom = (zoom: number) => Math.min(5, Math.max(0.55, zoom))
const flipped = (loops: Loop[]) => loops.map(loop => [...loop].reverse())

function Finishes() {
  return <defs>
    <linearGradient id="wood-light" x1="0" x2="0.87" y1="0" y2="1">
      <stop stopColor="#ebcc92" /><stop offset=".46" stopColor="#d5a968" /><stop offset="1" stopColor="#ba854b" />
    </linearGradient>
    <linearGradient id="wood-floor" x1="0" x2=".7" y1="0" y2="1">
      <stop stopColor="#a57a4a" /><stop offset=".56" stopColor="#8b6239" /><stop offset="1" stopColor="#715031" />
    </linearGradient>
    <linearGradient id="wood-rim" x1="0" x2="1" y1="0" y2=".8">
      <stop stopColor="#d1a876" /><stop offset=".48" stopColor="#ac794a" /><stop offset="1" stopColor="#936137" />
    </linearGradient>
    <linearGradient id="acrylic-glass" x1=".12" x2=".85" y1="0" y2="1">
      <stop stopColor="#d1f8f7" stopOpacity=".32" />
      <stop offset=".33" stopColor="#e2fbf0" stopOpacity=".06" />
      <stop offset=".6" stopColor="#dcfff2" stopOpacity=".2" />
      <stop offset=".68" stopColor="#e1ffff" stopOpacity=".045" />
      <stop offset="1" stopColor="#b4edd8" stopOpacity=".12" />
    </linearGradient>
    <radialGradient id="steel-ball" cx=".32" cy=".24" r=".82">
      <stop stopColor="#fff" /><stop offset=".18" stopColor="#e6ebed" /><stop offset=".51" stopColor="#909da2" />
      <stop offset=".78" stopColor="#344049" /><stop offset="1" stopColor="#c3d2d7" />
    </radialGradient>
    <pattern id="wood-grain" width="89" height="27" patternUnits="userSpaceOnUse">
      {Array.from({ length: 32 }, (_, i) =>
        <path key={i} d={`M-1 ${i * 0.85}q22 ${Math.sin(i * 2.11) * 2.35} 45 ${Math.cos(i) * 1.35}T90 ${i * 0.85}`}
          fill="none" stroke={i % 3 === 0 ? '#fff0c5' : '#452a18'} strokeOpacity={i % 4 === 0 ? .14 : .06} strokeWidth={i % 5 === 0 ? '.24' : '.12'} />)}
    </pattern>
    <filter id="preview-shadow" x="-20%" y="-20%" width="145%" height="160%">
      <feDropShadow dx="0" dy="3" stdDeviation="3.4" floodColor="#080a06" floodOpacity=".65" />
    </filter>
  </defs>
}

function RouteLines({ design }: { design: Design }) {
  return <g fill="none" stroke="#dfff8a" strokeWidth={design.clearance * .205} strokeLinecap="round" strokeLinejoin="round">
    {design.routes.map((route, index) => <path key={index} d={linePath(route)} />)}
  </g>
}

function Markers({ design }: { design: Design }) {
  return <g className="plan-markers">
    {markers(design).map(({ point, letter }, index) => (
      <g key={index} transform={`translate(${point.x} ${point.y})`}>
        <circle r={design.clearance * .385} fill="#35653f" stroke="#d3edaf" strokeWidth={design.clearance * .043} />
        <text y=".04em" dominantBaseline="central" textAnchor="middle" fill="#f2ffe3" fontSize={design.clearance * .47} fontWeight="750">{letter}</text>
      </g>
    ))}
  </g>
}

function Plan({ design, solution }: { design: Design; solution: boolean }) {
  const { left, right, top, bottom, width, height } = bounds(design.outline)
  const unit = Math.max(width, height) / 160
  const gap = 9 * unit
  const dim = 15 * unit
  const edge = loopsPath(design.outline)
  const maze = loopsPath([...design.outline, ...design.channels])
  const rim = loopsPath([...design.outline, ...design.window])
  const xMid = (left + right) / 2
  const yMid = (top + bottom) / 2
  return (
    <svg className="piece" viewBox={`${left - dim * 2.2} ${top - gap * 1.65} ${width + dim * 4.4} ${height + dim * 2.65}`} role="img" aria-label="Top view of the maze with dimension lines">
      <Finishes />
      <g filter="url(#preview-shadow)" fillRule="evenodd">
        <path d={edge} fill="url(#wood-floor)" />
        <path d={maze} fill="url(#wood-light)" stroke="#322012" strokeWidth={.42 * unit} />
        <path d={maze} fill="url(#wood-grain)" />
        <path d={rim} fill="url(#wood-rim)" stroke="#51341d" strokeWidth={.38 * unit} />
        <path d={rim} fill="url(#wood-grain)" />
        <path d={edge} fill="none" stroke="#e2b77e" strokeWidth={.42 * unit} />
        <path d={loopsPath(design.window)} fill="none" stroke="#f0c994" strokeOpacity=".54" strokeWidth={.35 * unit} />
      </g>
      {solution && <RouteLines design={design} />}
      <Markers design={design} />
      <g fill="none" stroke="#899281" strokeWidth={.32 * unit}>
        <path d={`M${left} ${bottom + gap * .65}v${gap * 1.08}m${width} 0v-${gap * 1.08}M${left} ${bottom + gap}H${xMid - dim}m${dim * 2} 0H${right} M${left - unit} ${bottom + gap + unit}l${unit * 2} ${-unit * 2}m${width - unit * 2} ${unit * 2}l${unit * 2} ${-unit * 2}`} />
        <path d={`M${right + gap * .65} ${top}h${gap * 1.08}m0 ${height}h-${gap * 1.08}M${right + gap} ${top}V${yMid - dim}m0 ${dim * 2}V${bottom}M${right + gap - unit} ${top + unit}l${unit * 2} ${-unit * 2}m${-unit * 2} ${height + unit * 2}l${unit * 2} ${-unit * 2}`} />
      </g>
      <g className="dimension-svg" textAnchor="middle" dominantBaseline="central" fontSize={3.7 * unit} fill="#b8c1b0">
        <text x={xMid} y={bottom + gap}>{width.toFixed(1)} mm</text>
        <text transform={`translate(${right + gap} ${yMid}) rotate(-90)`}>{height.toFixed(1)} mm</text>
      </g>
    </svg>
  )
}

function Model({ design, solution, angle, tilt, exploded }: {
  design: Design; solution: boolean; angle: number; tilt: number; exploded: boolean
}) {
  const { left, top, width, height } = bounds(design.outline)
  const cx = left + width / 2
  const cy = top + height / 2
  const major = Math.max(width, height)
  const space = exploded ? Math.min(18, major * .12) : 0
  const cap = outerLayerThickness + design.mazeThickness
  const sin = Math.sin(angle)
  const cos = Math.cos(angle)
  const slope = Math.cos(tilt)
  const rise = Math.sin(tilt)
  const depth = ({ x, y }: Point) => (x - cx) * sin + (y - cy) * cos
  const project = ({ x, y }: Point, z: number) => ({ x: (x - cx) * cos - (y - cy) * sin, y: depth({ x, y }) * slope - z * rise })
  const flat = (z: number) => `matrix(${cos} ${sin * slope} ${-sin} ${cos * slope} ${-cx * cos + cy * sin} ${-(cx * sin + cy * cos) * slope - z * rise})`
  const base = design.window.length ? design.window : design.outline

  function sideFaces(loops: Loop[], low: number, high: number, glass = false) {
    const faces = loops.flatMap(loop => loop.flatMap((a, index) => {
      const b = loop[(index + 1) % loop.length]
      const aTop = project(a, high)
      const bTop = project(b, high)
      if (bTop.x >= aTop.x) return []
      const light = 30 + 12 * (1 - Math.abs(depth(a) - depth(b)) / Math.hypot(a.x - b.x, a.y - b.y))
      return [{ d: linePath([aTop, bTop, project(b, low), project(a, low)], true), depth: (depth(a) + depth(b)) / 2, light }]
    }))
    return faces.sort((a, b) => a.depth - b.depth).map(({ d, light }, index) =>
      <path key={index} d={d} fill={glass ? '#87c9be' : `hsl(29 45% ${light}%)`} fillOpacity={glass ? '.4' : 1} />
    )
  }

  function surface(loops: Loop[], z: number, fill: string, extra?: ReactNode) {
    const path = loopsPath(loops)
    return <g transform={flat(z)} fillRule="evenodd">
      <path d={path} fill={fill} stroke="#dcb783" strokeWidth={major * .0018} />
      <path d={path} fill="url(#wood-grain)" />
      {extra}
    </g>
  }

  const middle = [...design.outline, ...flipped(design.channels)]
  const rim = [...design.outline, ...flipped(design.window)]
  const ballRadius = design.bearing / 2
  const ballPositions = design.routes.map(route => project(route[Math.min(1, route.length - 1)], outerLayerThickness + ballRadius))
  const extent = bounds(design.outline.map(loop => loop.map(point => project(point, 0))))
  const modelHeight = cap + outerLayerThickness + 2 * space
  const padding = major * .14
  return <svg className="piece" viewBox={`${extent.left - padding} ${extent.top - modelHeight * .71 - padding} ${extent.width + padding * 2} ${extent.height + modelHeight * .71 + padding * 2}`} role="img" aria-label="Three-dimensional model of the wooden maze and acrylic window">
    <Finishes />
    <g filter="url(#preview-shadow)">
      {sideFaces(base, 0, outerLayerThickness)}
      {surface(base, outerLayerThickness, 'url(#wood-floor)', <>{solution && exploded && <RouteLines design={design} />}<Markers design={design} /></>)}
      {sideFaces(middle, outerLayerThickness + space, cap + space)}
      {surface(middle, cap + space, 'url(#wood-light)')}
      {ballPositions.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r={ballRadius} fill="url(#steel-ball)" stroke="#4d4338" strokeWidth=".17" />)}
      {sideFaces(rim, cap + 2 * space, cap + outerLayerThickness + 2 * space)}
      {sideFaces(design.window, cap + 2 * space, cap + outerLayerThickness + 2 * space, true)}
      {surface(rim, cap + outerLayerThickness + 2 * space, 'url(#wood-rim)')}
      {design.window.length > 0 && <path d={loopsPath(design.window)} transform={flat(cap + outerLayerThickness + 2 * space)}
        fillRule="evenodd" fill="url(#acrylic-glass)" stroke="#d8f0d4" strokeOpacity=".42" strokeWidth={major * .002} />}
      {solution && !exploded && <g transform={flat(cap + outerLayerThickness)}>
        <RouteLines design={design} /><Markers design={design} />
      </g>}
    </g>
  </svg>
}

export function Preview({ design }: { design: Design }) {
  const [mode, setMode] = useState<'plan' | 'model'>('plan')
  const [solution, setSolution] = useState(false)
  const [exploded, setExploded] = useState(false)
  const [pan, setPan] = useState(false)
  const [camera, setCamera] = useState(startCamera)
  const viewport = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointer: number; x: number; y: number; pan: boolean } | null>(null)

  useEffect(() => {
    const element = viewport.current
    function wheel(event: WheelEvent) {
      if (mode === 'plan' && !event.ctrlKey) return
      event.preventDefault()
      setCamera(value => ({ ...value, zoom: limitZoom(value.zoom * Math.exp(-event.deltaY * .0016)) }))
    }
    element?.addEventListener('wheel', wheel, { passive: false })
    return () => element?.removeEventListener('wheel', wheel)
  }, [mode])

  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.button !== 2) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, pan: mode === 'plan' || pan || event.shiftKey || event.button === 2 }
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const old = drag.current
    if (!old || old.pointer !== event.pointerId) return
    const dx = event.clientX - old.x
    const dy = event.clientY - old.y
    drag.current = { ...old, x: event.clientX, y: event.clientY }
    setCamera(value => old.pan
      ? { ...value, x: value.x + dx, y: value.y + dy }
      : { ...value, angle: value.angle + dx * .011, tilt: Math.min(1.41, Math.max(.06, value.tilt + dy * .008)) })
  }

  function changeMode(next: 'plan' | 'model') {
    if (next === mode) return
    setCamera(startCamera)
    setMode(next)
  }

  const zoomBy = (factor: number) => setCamera(value => ({ ...value, zoom: limitZoom(value.zoom * factor) }))
  return <section className="preview" aria-label="Maze preview">
    <div className="preview-toolbar">
      <div className="view-switch" aria-label="View mode">
        <button type="button" aria-pressed={mode === 'plan'} onClick={() => changeMode('plan')}><ScanLine size={15} /> Top view</button>
        <button type="button" aria-pressed={mode === 'model'} onClick={() => changeMode('model')}><Box size={15} /> 3D view</button>
      </div>
      <div className="preview-toolbar-right">
        {mode === 'model' && <button className="text-button" type="button" aria-pressed={exploded} onClick={() => setExploded(!exploded)}>Explode layers</button>}
        <button className="solution-button" type="button" disabled={!!design.error} aria-pressed={solution} onClick={() => setSolution(!solution)}>
          <Route size={16} /><span>{solution ? 'Hide solution' : 'Show solution'}</span>
        </button>
      </div>
    </div>
    <div className="stage">
      <div className="viewport" ref={viewport} tabIndex={0}
        aria-label={mode === 'model' ? '3D viewport. Arrow keys rotate, Shift and arrow keys pan, plus and minus zoom.' : 'Top viewport. Arrow keys pan, plus and minus zoom.'}
        onPointerDown={beginDrag} onPointerMove={moveDrag} onLostPointerCapture={() => { drag.current = null }}
        onContextMenu={event => { if (mode === 'model') event.preventDefault() }}
        onKeyDown={event => {
          const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
          if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomBy(1.2) }
          if (event.key === '-') { event.preventDefault(); zoomBy(1 / 1.2) }
          if (!delta) return
          event.preventDefault()
          setCamera(value => mode === 'plan' || event.shiftKey || pan
            ? { ...value, x: value.x + delta[0] * 18, y: value.y + delta[1] * 18 }
            : { ...value, angle: value.angle + delta[0] * .12, tilt: Math.min(1.41, Math.max(.06, value.tilt + delta[1] * .1)) })
        }}>
        <div className="piece-position" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}>
          {mode === 'plan' ? <Plan design={design} solution={solution} /> : <Model design={design} solution={solution} angle={camera.angle} tilt={camera.tilt} exploded={exploded} />}
        </div>
      </div>
      {design.error && <div className="stage-warning" role="alert"><TriangleAlert size={17} />{design.error}</div>}
      <div className="view-controls" aria-label="Preview controls">
        {mode === 'model' && <button type="button" aria-label="Pan mode" title="Pan mode" aria-pressed={pan} onClick={() => setPan(!pan)}><Hand size={16} /></button>}
        <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => zoomBy(1 / 1.2)}><Minus size={16} /></button>
        <output aria-label="Zoom">{Math.round(camera.zoom * 100)}%</output>
        <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => zoomBy(1.2)}><Plus size={16} /></button>
        <button type="button" aria-label="Reset view" title="Reset view" className="reset-view" onClick={() => setCamera(startCamera)}><Crosshair size={16} /></button>
      </div>
      {mode === 'model' && <span className="view-help">{pan ? 'Drag to pan' : 'Drag to rotate · Shift-drag to pan'} · Scroll to zoom</span>}
      {mode === 'model' && <span className="model-height">{(design.mazeThickness + 2 * outerLayerThickness).toFixed(1)} mm assembled</span>}
      <span className="stage-unit">mm</span>
    </div>
  </section>
}
