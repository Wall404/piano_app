import { useEffect, useRef, useState } from 'react'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { rangesFromStarts } from '../import/collection'

const THUMB_PX = 120

/** Miniaturas de un PDF para marcar dónde empieza cada obra; arma el comando de `npm run pdf`. */
export default function PdfPages({ onBack }: { onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [starts, setStarts] = useState<number[]>([1])
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const canvases = useRef<(HTMLCanvasElement | null)[]>([])

  useEffect(() => {
    if (!file) return
    let cancelled = false
    let destroy = () => {}
    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
        const task = pdfjs.getDocument({ data: await file.arrayBuffer() })
        destroy = () => void task.destroy()
        const pdf = await task.promise
        if (cancelled) return
        setPageCount(pdf.numPages)
        await new Promise(requestAnimationFrame) // que React dibuje los canvas
        // Página por página, para no trabar el teléfono con un PDF largo.
        for (let n = 1; n <= pdf.numPages && !cancelled; n++) {
          const page = await pdf.getPage(n)
          const canvas = canvases.current[n - 1]
          if (!canvas) continue
          const viewport = page.getViewport({ scale: (THUMB_PX * devicePixelRatio) / page.getViewport({ scale: 1 }).width })
          canvas.width = viewport.width
          canvas.height = viewport.height
          await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? `No se pudo abrir el PDF: ${err.message}` : 'No se pudo abrir el PDF.')
      }
    })()
    return () => {
      cancelled = true
      destroy()
    }
  }, [file])

  const toggle = (page: number) => {
    if (page === 1) return
    setCopied(false)
    setStarts((s) => (s.includes(page) ? s.filter((p) => p !== page) : [...s, page]))
  }

  const ranges = rangesFromStarts(starts, pageCount)
  const name = file && (/\s/.test(file.name) ? `"${file.name}"` : file.name)
  const command = `npm run pdf -- ${name} --paginas ${ranges}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
    } catch {
      setError('No se pudo copiar: seleccioná el comando a mano.')
    }
  }

  return (
    <div className="library">
      <header className="brand">
        <button className="icon-btn back" onClick={onBack} aria-label="Volver a la biblioteca">←</button>
        <div>
          <h1>Marcar obras de un PDF</h1>
          <p>{pageCount ? `${pageCount} páginas · ${starts.filter((p) => p <= pageCount).length} obras` : 'Tocá la página donde empieza cada obra'}</p>
        </div>
      </header>

      <label className="drop">
        <strong>{file ? file.name : 'Elegir PDF'}</strong>
        <span>El PDF no se sube: las miniaturas se arman en este dispositivo.</span>
        <input
          type="file"
          accept=".pdf,application/pdf"
          hidden
          onChange={(e) => {
            const picked = e.target.files?.[0]
            e.target.value = ''
            if (!picked) return
            setError(null)
            setCopied(false)
            setPageCount(0)
            setStarts([1])
            setFile(picked)
          }}
        />
      </label>
      {error && <p className="midi-error" role="alert">{error}</p>}

      {pageCount > 0 && (
        <>
          <h2>Comando para la PC</h2>
          <pre className="chord-report">{command}</pre>
          <button className="midi-btn" onClick={() => void copy()}>{copied ? 'Copiado' : 'Copiar'}</button>

          <h2>Páginas</h2>
          <ul className="pdf-pages">
            {Array.from({ length: pageCount }, (_, i) => {
              const page = i + 1
              const start = starts.includes(page)
              return (
                <li key={page}>
                  <button className={start ? 'sel' : ''} aria-pressed={start} disabled={page === 1} onClick={() => toggle(page)}>
                    <canvas ref={(el) => void (canvases.current[i] = el)} />
                    {page}{start && ' · empieza una obra'}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
