// Lógica pura de las colecciones de PDF, separada para poder probarla sin Audiveris.

/** Convierte "1-2,3-5,7" en rangos de páginas. */
export function parseRanges(text) {
  return text.split(',').map((part) => {
    const match = /^\s*(\d+)(?:-(\d+))?\s*$/.exec(part)
    const from = Number(match?.[1])
    const to = Number(match?.[2] ?? match?.[1])
    if (!match || from < 1 || to < from) throw new Error(`Rango de páginas inválido: "${part.trim()}". Ejemplo: 1-2,3-5`)
    return { from, to }
  })
}

export const sheetsArg = ({ from, to }) => (from === to ? String(from) : `${from}-${to}`)

export const workFileName = (radix, index) => `${radix}.obra${index + 1}.mxl`

/** Elige lo que exportó Audiveris: pieza.mxl o pieza.mvt1.mxl, pieza.mvt2.mxl… en orden. */
export function exportedFiles(names, radix) {
  const movement = (name) => {
    if (!name.startsWith(radix)) return null
    const rest = name.slice(radix.length)
    if (rest === '.mxl') return 0
    const match = /^\.mvt(\d+)\.mxl$/.exec(rest)
    return match ? Number(match[1]) : null
  }
  return names.filter((n) => movement(n) !== null).sort((a, b) => movement(a) - movement(b))
}

const unescapeXml = (text) =>
  text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

/** Título que Audiveris leyó del encabezado, si leyó alguno. */
export function titleFromXml(xml) {
  const match = /<work-title>([^<]+)<\/work-title>/.exec(xml) ?? /<movement-title>([^<]+)<\/movement-title>/.exec(xml)
  return match ? unescapeXml(match[1]).trim() || null : null
}

export const fallbackTitle = (index, pages) => `Obra ${index + 1}${pages ? ` (pág. ${pages[0]})` : ''}`
