import { describe, expect, it } from 'vitest'
import { noteLevels, OnsetDetector } from '../src/eval/mic'

const LOW = 48
const SIZE = 12
const quiet = () => Array<number>(SIZE).fill(-90)
const threshold = Array<number>(SIZE).fill(-60)
const withNotes = (notes: Record<number, number>) => {
  const levels = quiet()
  for (const [midi, db] of Object.entries(notes)) levels[Number(midi) - LOW] = db
  return levels
}
const ons = (events: { midi: number; on: boolean }[]) => events.filter((e) => e.on).map((e) => e.midi)
/** Repite el mismo cuadro hasta que se confirma el ataque. */
const confirm = (d: OnsetDetector, levels: number[], limit: number[], expected = new Set<number>()) => {
  let heard: number[] = []
  for (let i = 0; i < 6; i++) heard = heard.concat(ons(d.update(levels, limit, expected)))
  return heard
}

describe('detección por micrófono', () => {
  it('lee el nivel en la fundamental de la nota', () => {
    const spectrum = new Float32Array(8192).fill(-100)
    const bin = Math.round((440 * 16384) / 48000)
    spectrum[bin] = -30
    const levels = noteLevels(spectrum, 48000, 69, 70)
    expect(levels[0]).toBe(-30)
    expect(levels[1]).toBe(-100)
  })

  it('descarta el ruido ancho del ataque', () => {
    const d = new OnsetDetector(LOW)
    d.update(quiet(), threshold, new Set())
    expect(confirm(d, Array<number>(SIZE).fill(-40), threshold)).toEqual([])
  })

  it('detecta las notas de un acorde a la vez', () => {
    const d = new OnsetDetector(LOW)
    d.update(quiet(), threshold, new Set())
    expect(confirm(d, withNotes({ 48: -40, 52: -42, 55: -41 }), threshold)).toEqual([48, 52, 55])
  })

  it('no repite una nota sostenida y sí un nuevo ataque', () => {
    const d = new OnsetDetector(LOW)
    d.update(quiet(), threshold, new Set())
    expect(confirm(d, withNotes({ 50: -40 }), threshold)).toEqual([50])
    for (let i = 0; i < 4; i++) expect(ons(d.update(withNotes({ 50: -42 - i }), threshold, new Set()))).toEqual([])
    expect(confirm(d, withNotes({ 50: -36 }), threshold)).toEqual([50])
  })

  it('ignora un armónico salvo que se espere esa nota', () => {
    const size = 13
    const floor = Array<number>(size).fill(-90)
    const limit = Array<number>(size).fill(-60)
    const octave = floor.slice()
    octave[0] = -40
    octave[12] = -44
    const plain = new OnsetDetector(LOW)
    plain.update(floor, limit, new Set())
    expect(confirm(plain, octave, limit)).toEqual([48])
    const expecting = new OnsetDetector(LOW)
    expecting.update(floor, limit, new Set())
    expect(confirm(expecting, octave, limit, new Set([60])).sort()).toEqual([48, 60])
  })
})
