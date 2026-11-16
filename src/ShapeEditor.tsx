import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { Circle, Eraser, Pencil, Square, Trash2, Undo2, X } from 'lucide-react'
import { bounds, loopsPath } from './geometry'
import type { Loop, Point } from './geometry'
import { createMask } from './mask'
import type { Mask } from './mask'

type Tool = 'brush' | 'rectangle' | 'ellipse'
const tools = [
  { id: 'brush', label: 'Brush', icon: Pencil },
  { id: 'rectangle', label: 'Rectangle', icon: Square },
  { id: 'ellipse', label: 'Ellipse', icon: Circle },
] as const
const width = 640
const height = 390

export function ShapeEditor({ outline, onClose, onApply }: {
  outline: Loop[]; onClose: () => void; onApply: (mask: Mask) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const history = useRef<ImageData[]>([])
  const drag = useRef<{ start: Point; last: Point; before: ImageData } | null>(null)
  const [undoCount, setUndoCount] = useState(0)
  const [tool, setTool] = useState<Tool>('brush')
  const [erase, setErase] = useState(false)
  const [stroke, setStroke] = useState(28)
  const [error, setError] = useState('')

  useEffect(() => {
    dialog.current?.showModal()
    const ctx = canvas.current!.getContext('2d', { willReadFrequently: true })!
    const frame = bounds(outline)
    const scale = Math.min((width - 60) / frame.width, (height - 54) / frame.height)
    ctx.setTransform(scale, 0, 0, scale, (width - frame.width * scale) / 2 - frame.left * scale,
      (height - frame.height * scale) / 2 - frame.top * scale)
    ctx.fill(new Path2D(loopsPath(outline)), 'evenodd')
    ctx.resetTransform()
  }, [outline])

  const context = () => canvas.current!.getContext('2d', { willReadFrequently: true })!

  function remember(before: ImageData) {
    history.current = [...history.current.slice(-19), before]
    setUndoCount(history.current.length)
  }

  function undo() {
    const before = history.current.pop()
    if (!before) return
    context().putImageData(before, 0, 0)
    setUndoCount(history.current.length)
    setError('')
  }

  function position(event: PointerEvent<HTMLCanvasElement>): Point {
    const box = event.currentTarget.getBoundingClientRect()
    return { x: (event.clientX - box.left) * width / box.width, y: (event.clientY - box.top) * height / box.height }
  }

  function paint(ctx: CanvasRenderingContext2D, a: Point, b: Point) {
    ctx.save()
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over'
    ctx.fillStyle = '#000'
    ctx.strokeStyle = '#000'
    ctx.beginPath()
    if (tool === 'brush') {
      ctx.lineWidth = stroke
      ctx.lineCap = 'round'
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x + (a.x === b.x && a.y === b.y ? .001 : 0), b.y)
      ctx.stroke()
    } else if (tool === 'rectangle') {
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y)
    } else {
      ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  function start(event: PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0 || drag.current) return
    setError('')
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = position(event)
    const ctx = context()
    drag.current = { start: point, last: point, before: ctx.getImageData(0, 0, width, height) }
    if (tool === 'brush') paint(ctx, point, point)
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    const action = drag.current
    if (!action || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    const point = position(event)
    const ctx = context()
    if (tool !== 'brush') ctx.putImageData(action.before, 0, 0)
    paint(ctx, tool === 'brush' ? action.last : action.start, point)
    action.last = point
  }

  function finish(event: PointerEvent<HTMLCanvasElement>) {
    if (!drag.current) return
    move(event)
    remember(drag.current.before)
    drag.current = null
  }

  function apply() {
    try {
      onApply(createMask(context().getImageData(0, 0, width, height), 'Drawn outline'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The outline could not be read.')
    }
  }

  return <dialog ref={dialog} className="shape-dialog" aria-labelledby="editor-title" onCancel={event => { event.preventDefault(); onClose() }}
    onKeyDown={event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undo()
      }
    }}>
    <div className="dialog-heading">
      <div><h2 id="editor-title">Shape editor</h2><p>Draw the silhouette in black. Erase areas to create holes.</p></div>
      <button type="button" className="icon-button" aria-label="Close shape editor" onClick={onClose}><X size={19} /></button>
    </div>
    <div className="editor-toolbar" aria-label="Shape tools">
      {tools.map(({ id, label, icon: Icon }) => <button type="button" key={id} className="editor-tool" aria-pressed={tool === id}
        onClick={() => setTool(id)}><Icon size={16} />{label}</button>)}
      <button type="button" className="editor-tool erase-tool" aria-pressed={erase} onClick={() => setErase(!erase)}><Eraser size={16} /> Erase</button>
      <div className="editor-history">
        <button type="button" className="icon-button" aria-label="Undo" title="Undo" disabled={!undoCount} onClick={undo}><Undo2 size={17} /></button>
        <button type="button" className="icon-button" aria-label="Clear canvas" title="Clear canvas" onClick={() => {
          const ctx = context()
          remember(ctx.getImageData(0, 0, width, height))
          ctx.clearRect(0, 0, width, height)
          setError('')
        }}><Trash2 size={17} /></button>
      </div>
    </div>
    <canvas aria-label="Outline drawing canvas" ref={canvas} width={width} height={height}
      onPointerDown={start} onPointerMove={move} onPointerUp={finish} onLostPointerCapture={() => { drag.current = null }} />
    <div className="editor-options">{tool === 'brush' && <label>
      Brush size <input type="range" min={5} max={95} value={stroke} onChange={event => setStroke(event.currentTarget.valueAsNumber)} />
      <output>{stroke} px</output>
    </label>}</div>
    {error && <p className="inline-error" role="alert">{error}</p>}
    <div className="dialog-actions">
      <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
      <button type="button" className="primary-button" onClick={apply}>Use outline</button>
    </div>
  </dialog>
}
