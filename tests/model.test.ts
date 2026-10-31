import { describe, expect, it } from 'vitest'
import { odeToJoy, odeToJoySections } from '../src/data/odeToJoy'
import { parseMidiMessage } from '../src/eval/midiInput'
import { buildLayout, fitRange, parseNote, PIANO_HIGH, PIANO_LOW } from '../src/model/notes'
import { groupChords, measureAt, nextChord, scoreEnd, sectionRange } from '../src/model/score'

const beat = 60 / odeToJoy.bpm
const both = { L: true, R: true }

describe('notas y teclado', () => {
  it('convierte nombres a MIDI', () => {
    expect(parseNote('C4')).toBe(60)
    expect(parseNote('F#3')).toBe(54)
    expect(parseNote('Bb2')).toBe(46)
  })

  it('arma las 88 teclas', () => {
    const keys = [...buildLayout(PIANO_LOW, PIANO_HIGH).keys.values()]
    expect(keys).toHaveLength(88)
    expect(keys.filter((k) => k.black)).toHaveLength(36)
  })

  it('ajusta el rango a octavas completas dentro del piano', () => {
    expect(fitRange(43, 67)).toEqual([36, 71])
    expect(fitRange(21, 108)).toEqual([PIANO_LOW, PIANO_HIGH])
  })
})

describe('partitura', () => {
  it('tiene 16 compases en segundos a tempo original', () => {
    expect(odeToJoy.measures).toHaveLength(16)
    expect(scoreEnd(odeToJoy)).toBeCloseTo(64 * beat)
    expect(measureAt(odeToJoy, 8 * beat)).toBe(3)
  })

  it('calcula el rango de una sección por compases', () => {
    const range = sectionRange(odeToJoy, odeToJoySections[1])
    expect(range.start).toBeCloseTo(16 * beat)
    expect(range.end).toBeCloseTo(32 * beat)
  })

  it('agrupa acordes por tiempo de inicio', () => {
    const first = groupChords(odeToJoy.notes)[0]
    expect(first.notes.map((n) => n.midi)).toEqual([48, 52, 55, 64])
  })
})

describe('modo espera', () => {
  const chords = groupChords(odeToJoy.notes)
  const all = sectionRange(odeToJoy, null)

  it('devuelve el acorde siguiente al último resuelto', () => {
    expect(nextChord(chords, -Infinity, all, both)?.time).toBe(0)
    expect(nextChord(chords, 0, all, both)?.time).toBeCloseTo(beat)
  })

  it('ignora la mano apagada y lo que queda fuera de la sección', () => {
    const onlyLeft = { L: true, R: false }
    expect(nextChord(chords, 0, all, onlyLeft)?.time).toBeCloseTo(beat * 4)
    const frase2 = sectionRange(odeToJoy, odeToJoySections[1])
    expect(nextChord(chords, -Infinity, frase2, both)?.time).toBeCloseTo(beat * 16)
    expect(nextChord(chords, frase2.end - 0.01, frase2, both)).toBeNull()
  })
})

describe('mensajes MIDI', () => {
  it('interpreta note on y note off en cualquier canal', () => {
    expect(parseMidiMessage([0x90, 60, 100])).toEqual({ midi: 60, on: true })
    expect(parseMidiMessage([0x93, 60, 0])).toEqual({ midi: 60, on: false })
    expect(parseMidiMessage([0x80, 60, 40])).toEqual({ midi: 60, on: false })
    expect(parseMidiMessage([0xb0, 64, 127])).toBeNull()
  })
})
