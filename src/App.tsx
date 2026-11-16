import { useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  Check, ChevronRight, Download, Hexagon, ImagePlus, Layers3, PencilRuler, Pentagon, Ruler,
  Shuffle, SlidersHorizontal, Square, Triangle, TriangleAlert,
} from 'lucide-react'
import { cutContour, cutFiles, download, makeSvg, placeOnSheet } from './export'
import type { FileKind } from './export'
import { bounds, linePath, loopsPath } from './geometry'
import type { Preset } from './geometry'
import { loadMask } from './mask'
import type { Mask } from './mask'
import { generateDesign } from './maze'
import type { Design, Outline } from './maze'
import { Preview } from './Preview'
import { ShapeEditor } from './ShapeEditor'

const presets = [
  { name: 'Hexagon', icon: Hexagon },
  { name: 'Pentagon', icon: Pentagon },
  { name: 'Square', icon: Square },
  { name: 'Triangle', icon: Triangle },
] satisfies { name: Preset; icon: typeof Hexagon }[]

const complexityLabels = ['Very simple', 'Simple', 'Balanced', 'Detailed', 'Intricate']

function Wordmark() {
  return <div className="wordmark">
    <div className="brand-mark" aria-hidden="true">
      <svg width="25" height="25" viewBox="0 0 25 25" fill="none">
        <path d="M12.5 2.5 22 8v9l-9.5 5.5L3 17V8l5.1-3m4.4 2.4 5.4 3.1v4.5l-5.4 3.1-5.4-3.1v-4.5l2.7-1.55m2.7 2.3 2.05 1.25-2.05 1.2" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
    <span>Maze<span className="wordmark-space"> </span>Workshop</span>
  </div>
}

function Measurement({ id, label, value, min, max, step, onChange }: {
  id: string; label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return <label className="measurement" htmlFor={id}>
    <span>{label}</span>
    <span className="input-shell">
      <input id={id} type="number" step={step} min={min} max={max} value={draft ?? value}
        onChange={event => {
          const { value: text, valueAsNumber: next } = event.currentTarget
          setDraft(text)
          if (next >= min && next <= max) onChange(next)
        }}
        onBlur={() => {
          if (draft !== null && draft !== '' && Number.isFinite(Number(draft))) onChange(Math.min(max, Math.max(min, Number(draft))))
          setDraft(null)
        }}
        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} />
      <span>mm</span>
    </span>
  </label>
}

function FileThumbnail({ design, file }: { design: Design; file: FileKind }) {
  const geometry = file === 'acrylic' && design.window.length ? design.window : design.outline
  const { left, top, width, height } = bounds(geometry)
  const inset = Math.max(width, height) * .1
  return <svg viewBox={`${left - inset} ${top - inset} ${width + 2 * inset} ${height + 2 * inset}`} aria-hidden="true">
    <path d={loopsPath(geometry)} fill="currentColor" fillOpacity=".11" fillRule="evenodd" />
    <g fill="none" stroke="currentColor" strokeWidth={Math.max(width, height) * .025} strokeLinejoin="round">
      {file === 'solution'
        ? <><path d={loopsPath(design.outline)} opacity=".35" />
          {design.routes.map((route, index) => <path key={index} d={linePath(route)} />)}</>
        : <path d={cutContour(design, file) || loopsPath(geometry)} />}
    </g>
  </svg>
}

export default function App() {
  const [outline, setOutline] = useState<Outline>('Hexagon')
  const [cellShape, setCellShape] = useState<Preset>('Square')
  const [complexity, setComplexity] = useState(3)
  const [bearing, setBearing] = useState(6)
  const [width, setWidth] = useState(160)
  const [sheetWidth, setSheetWidth] = useState(300)
  const [sheetHeight, setSheetHeight] = useState(200)
  const [seed, setSeed] = useState(88271)
  const [editor, setEditor] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [importing, setImporting] = useState(false)
  const [packing, setPacking] = useState(false)
  const [notice, setNotice] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const importRequest = useRef(0)

  const design = useMemo(() => generateDesign(outline, width, bearing, complexity, seed, cellShape),
    [outline, width, bearing, complexity, seed, cellShape])
  const sheet = { width: sheetWidth, height: sheetHeight }
  const placement = placeOnSheet(design, sheet)
  const ready = !!placement && !design.error
  const custom = typeof outline !== 'string'

  function selectOutline(next: Outline) {
    importRequest.current++
    setImporting(false)
    setUploadError('')
    setOutline(next)
  }

  async function importOutline(file: File) {
    const request = ++importRequest.current
    setImporting(true)
    setUploadError('')
    try {
      const imported = await loadMask(file)
      if (request === importRequest.current) selectOutline(imported)
    } catch (err) {
      if (request === importRequest.current) {
        setUploadError(err instanceof Error && err.message.startsWith('Draw or import') ? err.message : 'Could not read this image. Try a PNG, JPG, or SVG.')
      }
    } finally {
      if (request === importRequest.current) setImporting(false)
    }
  }

  async function exportZip() {
    if (!ready || !placement || packing) return
    setPacking(true)
    setNotice('')
    try {
      const { default: JSZip } = await import('jszip')
      const archive = new JSZip()
      for (const file of cutFiles) archive.file(file.filename, makeSvg(design, sheet, placement, file.id))
      const zip = await archive.generateAsync({ type: 'blob', compression: 'DEFLATE' })
      download(zip, 'maze-workshop.zip')
      setNotice('ZIP downloaded · 4 SVG files')
    } catch {
      setNotice('Could not create the ZIP. Try again.')
    } finally {
      setPacking(false)
    }
  }

  return <>
    <header className="app-header">
      <Wordmark />
      <div className="header-action">
        <span className="export-format"><Layers3 size={16} /> 4 SVG files</span>
        <button type="button" className="primary-button" disabled={!ready || packing} onClick={exportZip}>
          <Download size={17} /> {packing ? 'Preparing ZIP…' : 'Download ZIP'}
        </button>
      </div>
    </header>
    <div className="workspace">
      <aside className="settings" aria-label="Design settings">
        <div className="settings-heading"><SlidersHorizontal size={17} /><h2>Design settings</h2></div>
        <section className="settings-section">
          <h3>Board outline</h3>
          <div className="presets" role="group" aria-label="Preset board outlines">
            {presets.map(({ name, icon: Icon }) => <button className="preset" type="button" key={name}
              aria-label={`${name} outline`} aria-pressed={outline === name}
              onClick={() => selectOutline(name)}><Icon size={23} strokeWidth={1.45} /><span>{name}</span></button>)}
          </div>
          <div className="custom-heading">
            <span>Custom outline</span>
            {custom && <span className="active-label"><Check size={12} /> In use</span>}
          </div>
          <input ref={fileInput} type="file" id="outline-file" accept="image/*,.svg" hidden onChange={event => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (file) void importOutline(file)
          }} />
          <div className="custom-actions">
            <button type="button" className="secondary-button" onClick={() => fileInput.current?.click()}>
              <ImagePlus size={15} /> {importing ? 'Reading…' : 'Import image'}
            </button>
            <button type="button" className="secondary-button" onClick={() => setEditor(true)}><PencilRuler size={15} /> Draw shape</button>
          </div>
          {custom && <p className="custom-name" title={(outline as Mask).label}>{(outline as Mask).label}</p>}
          <p className="field-help">Use black for wood and white or transparency for cutouts.</p>
          {uploadError && <p className="inline-error" role="alert">{uploadError}</p>}
        </section>

        <section className="settings-section">
          <h3>Maze cells</h3>
          <div className="presets cell-presets" role="group" aria-label="Maze cell shapes">
            {presets.map(({ name, icon: Icon }) => <button className="preset" type="button" key={name}
              aria-label={`${name} cells`} aria-pressed={cellShape === name} onClick={() => setCellShape(name)}>
              <Icon size={21} strokeWidth={1.45} /><span>{name}</span>
            </button>)}
          </div>
          <div className="section-label">
            <h3><label htmlFor="complexity">Complexity</label></h3>
            <output htmlFor="complexity" className="complexity-label">{complexityLabels[complexity - 1]}</output>
          </div>
          <input className="complexity" id="complexity" type="range" min="1" max="5" step="1" value={complexity}
            aria-valuetext={complexityLabels[complexity - 1]} onChange={event => setComplexity(event.currentTarget.valueAsNumber)}
            style={{ '--progress': `${(complexity - 1) * 25}%` } as CSSProperties} />
          <div className="slider-labels"><span>Simple</span><span>Intricate</span></div>
        </section>

        <section className="settings-section">
          <h3>Dimensions</h3>
          <div className="number-row">
            <Measurement id="bearing" label="Ball diameter" value={bearing} min={1} max={40} step={.25} onChange={setBearing} />
            <Measurement id="board-width" label="Board width" value={width} min={18} max={1200} step={1} onChange={setWidth} />
          </div>
          <p className="field-help">Passages are at least 0.25 mm wider than the ball.</p>
        </section>

        <section className="settings-section stock-section">
          <h3>Cutting sheet</h3>
          <div className="number-row">
            <Measurement id="sheet-width" label="Width" value={sheetWidth} min={1} max={3000} step={1} onChange={setSheetWidth} />
            <Measurement id="sheet-height" label="Height" value={sheetHeight} min={1} max={3000} step={1} onChange={setSheetHeight} />
          </div>
          <p className={`fit-status ${placement ? 'fits' : 'no-fit'}`} role="status">
            {placement ? <Check size={14} /> : <TriangleAlert size={14} />}
            {placement ? (placement.rotated ? 'Fits with a 90° rotation' : 'Design fits on the sheet') : 'Design exceeds the sheet size'}
          </p>
        </section>
      </aside>

      <main className="main">
        <div className="main-heading">
          <div>
            <h1>Maze preview</h1>
            <div className="design-meta">
              <span>{custom ? 'Custom outline' : `${outline} outline`}</span>
              <span className="meta-dot" /><span>{design.error ? `${cellShape} cells` : `${design.cells} ${cellShape.toLowerCase()} cells`}</span>
              {!design.error && <><span className="meta-dot" />
                <span>{design.routes.length} {design.routes.length === 1 ? 'solution' : 'solutions'}</span></>}
            </div>
          </div>
          <button type="button" className="secondary-button shuffle" disabled={!!design.error} onClick={() => setSeed(value => (value + 1) >>> 0)}>
            <Shuffle size={16} /> New layout
          </button>
        </div>
        <Preview design={design} />
        <div className="readouts" aria-label="Finished dimensions">
          <div className="readout"><Ruler size={16} /><div><span>Overall size</span><strong>{design.width.toFixed(1)} × {design.height.toFixed(1)} <small>mm</small></strong></div></div>
          <div className="readout"><ChevronRight size={16} /><div><span>Minimum passage width</span><strong>{design.clearance.toFixed(2)} <small>mm</small></strong></div></div>
          <div className="readout"><Layers3 size={16} /><div><span>Maze stock thickness</span><strong>{design.mazeThickness.toFixed(1)} <small>mm min.</small></strong></div></div>
        </div>

        <section className="files" aria-labelledby="cut-files-title">
          <div className="files-heading">
            <h2 id="cut-files-title">Cut files</h2>
            <span>SVG · 1:1 scale</span>
            <button type="button" className="secondary-button" title="Download all four SVGs as a ZIP"
              disabled={!ready || packing} onClick={exportZip}>
              <Download size={15} /> {packing ? 'Preparing ZIP…' : 'Download all'}
            </button>
          </div>
          <div className="file-list">
            {cutFiles.map(file => <article className="file-card" key={file.id}>
              <div className={`file-thumbnail thumbnail-${file.id}`}><FileThumbnail design={design} file={file.id} /></div>
              <div className="file-info"><h3>{file.name}</h3><p>{file.material}</p></div>
              <button type="button" className="icon-button file-download" aria-label={`Download ${file.name} SVG`}
                title={`Download ${file.filename}`} disabled={!ready} onClick={() => {
                  if (!placement) return
                  download(new Blob([makeSvg(design, sheet, placement, file.id)], { type: 'image/svg+xml' }), file.filename)
                  setNotice(`Downloaded ${file.filename}`)
                }}><Download size={16} /></button>
            </article>)}
          </div>
        </section>
      </main>
    </div>
    <div className={notice ? 'toast' : 'sr-only'} role="status">
      {notice && <><span>{notice}</span><button className="text-button" type="button" onClick={() => setNotice('')}>Dismiss</button></>}
    </div>
    {editor && <ShapeEditor outline={design.outline} onClose={() => setEditor(false)} onApply={next => {
      selectOutline(next)
      setEditor(false)
    }} />}
  </>
}
