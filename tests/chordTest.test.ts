import { describe, expect, it } from 'vitest'
import { CHORDS, report, scoreAttempt, summarize, type TestChord } from '../src/eval/chordTest'

const chord: TestChord = { name: 'Do mayor', notes: [60, 64, 67], register: 'medios' }
const low: TestChord = { name: 'Sol mayor', notes: [43, 47, 50], register: 'graves' }

describe('prueba de acordes', () => {
  it('un acorde completo no tiene faltantes', () => {
    expect(scoreAttempt(chord, [67, 60, 64])).toMatchObject({ complete: true, hits: [60, 64, 67], missed: [], extras: [] })
  })

  it('separa faltantes y notas de más, y cuenta una vez las repetidas', () => {
    expect(scoreAttempt(chord, [60, 60, 72, 64, 48])).toMatchObject({
      complete: false,
      hits: [60, 64],
      missed: [67],
      extras: [48, 72],
    })
  })

  it('un intento sin notas detectadas no acierta nada', () => {
    expect(scoreAttempt(chord, [])).toMatchObject({ complete: false, hits: [], missed: [60, 64, 67], extras: [] })
  })

  it('resume en total y por registro, en orden de grave a agudo', () => {
    const { total, byRegister } = summarize([scoreAttempt(chord, [60, 64, 67, 72]), scoreAttempt(low, [43])])
    expect(total).toEqual({ chords: 2, complete: 1, notes: 6, hits: 4, extras: 1 })
    expect(byRegister.map((r) => [r.register, r.hits])).toEqual([['graves', 1], ['medios', 3]])
  })

  it('el texto para copiar trae los porcentajes y el detalle', () => {
    const text = report({
      date: '2026-11-02T12:00:00.000Z',
      attempts: [scoreAttempt(chord, [60, 64])],
      device: { chordsSupported: true, latencyMs: 200, noiseFloorDb: -70, centsOffset: 3, sensitivityDb: 22 },
    })
    expect(text).toContain('Acordes completos: 0 de 1 (0 %)')
    expect(text).toContain('Notas detectadas: 2 de 3 (67 %)')
    expect(text).toContain('Medios: 0 de 1 completos')
    expect(text).toContain('faltaron: Sol4')
  })

  it('la lista fija son tríadas en orden ascendente', () => {
    expect(CHORDS.length).toBe(10)
    for (const { notes } of CHORDS) expect(notes).toEqual([...new Set(notes)].sort((a, b) => a - b))
    expect(CHORDS.every((c) => c.notes.length === 3)).toBe(true)
  })
})
