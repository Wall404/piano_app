// Unir y separar obras editando el texto MusicXML (score-partwise).

const ORDER = ['divisions', 'key', 'time', 'staves', 'clef']

function parse(xml: string) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('El archivo MusicXML no es válido.')
  return doc
}

const serialize = (doc: Document) => new XMLSerializer().serializeToString(doc)
const partsOf = (doc: Document) => [...doc.getElementsByTagName('part')]
const measuresOf = (part: Element) => [...part.children].filter((c) => c.tagName === 'measure')
const renumber = (part: Element) => measuresOf(part).forEach((m, i) => m.setAttribute('number', String(i + 1)))
// Los clef se distinguen por pentagrama; el resto de los atributos es uno solo.
const slot = (el: Element) => (el.tagName === 'clef' ? `clef:${el.getAttribute('number') ?? '1'}` : el.tagName)

/** Texto MusicXML de un .musicxml/.xml o de un .mxl (zip). */
export async function readXml(file: Blob, name: string): Promise<string> {
  if (!/\.mxl$/i.test(name)) return file.text()
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(file)
  const container = await zip.file('META-INF/container.xml')?.async('string')
  const root = container && parse(container).getElementsByTagName('rootfile')[0]?.getAttribute('full-path')
  const entry = (root && zip.file(root)) || zip.file(/^(?!META-INF\/).*\.xml$/i)[0]
  if (!entry) throw new Error('El archivo .mxl no trae una partitura.')
  return entry.async('string')
}

export const countMeasures = (xml: string) => {
  const [part] = partsOf(parse(xml))
  return part ? measuresOf(part).length : 0
}

/** Pega los compases de B al final de A, parte por parte. */
export function mergeXml(a: string, b: string) {
  const docA = parse(a)
  const partsA = partsOf(docA)
  const partsB = partsOf(parse(b))
  if (partsA.length !== partsB.length) throw new Error('Las obras tienen distinta cantidad de partes y no se pueden unir.')
  partsA.forEach((part, i) => {
    for (const m of measuresOf(partsB[i])) part.appendChild(docA.importNode(m, true))
    renumber(part)
  })
  return serialize(docA)
}

/** Corta en el compás `from` (1-based): la segunda obra empieza ahí, con los atributos vigentes. */
export function splitXml(xml: string, from: number): [string, string] {
  const count = countMeasures(xml)
  if (!Number.isInteger(from) || from < 2 || from > count) {
    throw new Error(`El compás para separar tiene que estar entre 2 y ${count}.`)
  }
  const first = parse(xml)
  for (const part of partsOf(first)) measuresOf(part).slice(from - 1).forEach((m) => m.remove())

  const second = parse(xml)
  for (const part of partsOf(second)) {
    const measures = measuresOf(part)
    const carried = new Map<string, Element>()
    for (const m of measures.slice(0, from - 1)) {
      for (const attrs of m.getElementsByTagName('attributes')) {
        for (const el of attrs.children) if (ORDER.includes(el.tagName)) carried.set(slot(el), el)
      }
      m.remove()
    }
    const head = measures[from - 1]
    let attrs = [...head.children].find((c) => c.tagName === 'attributes')
    if (!attrs) {
      attrs = second.createElement('attributes')
      head.insertBefore(attrs, head.firstChild)
    }
    const declared = new Set([...attrs.children].map(slot))
    for (const [key, el] of carried) if (!declared.has(key)) attrs.appendChild(el.cloneNode(true))
    const rank = (el: Element) => (ORDER.includes(el.tagName) ? ORDER.indexOf(el.tagName) : ORDER.length)
    for (const el of [...attrs.children].sort((x, y) => rank(x) - rank(y))) attrs.appendChild(el) // sort es estable
    renumber(part)
  }
  return [serialize(first), serialize(second)]
}
