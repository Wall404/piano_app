import { useEffect, useRef, useState } from 'react'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { importAndSave, rangesFromStarts } from '../import/collection'

const THUMB_PX = 120
// Solo existe cuando la app corre en la PC (npm run dev): ver pdfHelper en vite.config.js.
const CAN_CONVERT = import.meta.env.DEV

/** Pasos guiados para convertir un PDF (una obra o varias) en partituras de la biblioteca. */
export default function PdfPages({ file, onBack }: { file: File; onBack: () => void }) {
  const [pageCount, setPageCount] = useState(0)
  const [starts, setStarts] = useState<number[]>([1])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const canvases = useRef<(HTMLCanvasElement | null)[]>([])

  useEffect(() => {
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
    setStarts((s) => (s.includes(page) ? s.filter((p) => p !== page) : [...s, page]))
  }

  const marked = starts.length > 1
  const ranges = rangesFromStarts(starts, pageCount)

  const convert = async () => {
    setBusy(true)
    setError(null)
    try {
      const query = new URLSearchParams({ name: file.name, ...(marked ? { paginas: ranges } : {}) })
      const response = await fetch(`${import.meta.env.BASE_URL}api/pdf?${query}`, { method: 'POST', body: file })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'La PC no pudo convertir el PDF.')
      const files = (data.files as { name: string; data: string }[]).map(
        (f) => new File([Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0))], f.name),
      )
      // Una sola obra queda suelta, sin el .coleccion.json.
      const works = files.filter((f) => !f.name.endsWith('.json'))
      await importAndSave(works.length === 1 ? works : files)
      onBack()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La PC no pudo convertir el PDF.')
      setBusy(false)
    }
  }

  return (
    <div className="library">
      <header className="brand">
        <button className="icon-btn back" onClick={onBack} aria-label="Volver a la biblioteca">←</button>
        <div>
          <h1>Convertir un PDF</h1>
          <p>{file.name}</p>
        </div>
      </header>
      <p className="empty">
        Un PDF es una foto de la partitura. Para mostrarla en el teclado, la app tiene que leer las notas, y eso lo hace la PC.
      </p>

      <h2>1 · ¿Dónde empieza cada obra?</h2>
      <p className="empty">
        Si el PDF trae varias obras, tocá la primera página de cada una. Si es una sola, o si varias comparten página (como
        estudios cortos), no marques nada: la PC intenta separarlas y después podés ajustar con ✎ en la biblioteca.
      </p>
      {pageCount > 0 && (
        <ul className="pdf-pages">
          {Array.from({ length: pageCount }, (_, i) => {
            const page = i + 1
            const start = marked && starts.includes(page)
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
      )}

      <section className="pdf-convert">
        <h2>2 · Convertir</h2>
        <p className="empty">
          {pageCount ? `${pageCount} páginas · ` : ''}
          {marked ? `${starts.length} obras marcadas` : 'sin marcas: la PC detecta las obras'}
        </p>
        {error && <p className="midi-error" role="alert">{error}</p>}
        {CAN_CONVERT ? (
          <button className="midi-btn primary" disabled={busy || !pageCount} onClick={() => void convert()}>
            {busy ? 'Convirtiendo… puede tardar unos minutos' : 'Convertir y agregar a la biblioteca'}
          </button>
        ) : (
          <p className="empty">
            El celular no puede leer las notas de un PDF. En la PC, abrí «Práctica Piano» desde el menú de aplicaciones,
            cargá este mismo PDF y tocá «Convertir».
          </p>
        )}
      </section>
    </div>
  )
}
