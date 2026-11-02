import { describe, expect, it } from 'vitest'
import { exportedFiles, fallbackTitle, parseRanges, sheetsArg, titleFromXml, workFileName } from '../scripts/collection.mjs'
import { commonTitle, parseManifest, planCollection } from '../src/import/collection'

describe('script de PDF', () => {
  it('lee rangos de páginas y páginas sueltas', () => {
    expect(parseRanges('1-2, 3-5,7')).toEqual([{ from: 1, to: 2 }, { from: 3, to: 5 }, { from: 7, to: 7 }])
    expect(sheetsArg({ from: 3, to: 5 })).toBe('3-5')
    expect(sheetsArg({ from: 7, to: 7 })).toBe('7')
  })

  it('rechaza rangos inválidos', () => {
    for (const bad of ['', 'a', '3-1', '0-2', '1-2,,3']) expect(() => parseRanges(bad)).toThrow()
  })

  it('ordena los movimientos por número y no toma archivos ajenos', () => {
    const names = ['pieza.mvt10.mxl', 'pieza.mvt2.mxl', 'pieza.mvt1.mxl', 'otra.mxl', 'pieza2.mxl', 'pieza.omr']
    expect(exportedFiles(names, 'pieza')).toEqual(['pieza.mvt1.mxl', 'pieza.mvt2.mxl', 'pieza.mvt10.mxl'])
    expect(exportedFiles(['pieza.mxl'], 'pieza')).toEqual(['pieza.mxl'])
  })

  it('nombra obras y títulos', () => {
    expect(workFileName('pieza', 0)).toBe('pieza.obra1.mxl')
    expect(titleFromXml('<work><work-title> Vals &amp; Fuga </work-title></work>')).toBe('Vals & Fuga')
    expect(titleFromXml('<movement-title>Preludio</movement-title>')).toBe('Preludio')
    expect(titleFromXml('<score-partwise/>')).toBeNull()
    expect(fallbackTitle(2, [7, 9])).toBe('Obra 3 (pág. 7)')
    expect(fallbackTitle(2)).toBe('Obra 3')
  })
})

describe('colecciones en la app', () => {
  it('sin manifiesto ordena con números naturales y titula por la parte común', () => {
    const plan = planCollection(['pieza.obra10.mxl', 'pieza.obra2.mxl'], null)
    expect(plan.obras.map((o) => o.file)).toEqual(['pieza.obra2.mxl', 'pieza.obra10.mxl'])
    expect(plan.title).toBe('pieza')
    expect(commonTitle(['vals.xml', 'fuga.xml'])).toBe('Colección de 2 obras')
  })

  it('con manifiesto respeta su orden y sus títulos', () => {
    const manifest = parseManifest(JSON.stringify({ title: 'Cuaderno', pdfName: 'c.pdf', obras: [{ file: 'b.mxl', title: 'Dos', pages: [3, 4] }, { file: 'a.mxl' }] }))
    const plan = planCollection(['a.mxl', 'b.mxl'], manifest)
    expect(plan.title).toBe('Cuaderno')
    expect(plan.obras[0]).toEqual({ file: 'b.mxl', title: 'Dos', pages: [3, 4] })
  })

  it('avisa si falta un archivo o el manifiesto está roto', () => {
    const manifest = { title: 'C', pdfName: '', obras: [{ file: 'a.mxl' }, { file: 'b.mxl' }] }
    expect(() => planCollection(['a.mxl'], manifest)).toThrow('b.mxl')
    expect(() => parseManifest('{')).toThrow()
    expect(() => parseManifest('{"title":"C"}')).toThrow()
  })
})
