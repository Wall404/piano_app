import { octaveOf, solfeo } from '../model/notes'

export type Register = 'graves' | 'medios' | 'agudos'

export interface TestChord {
  name: string
  notes: number[]
  register: Register
}

// Tríadas de 3 notas en los tres registros de la calibración, con inversiones.
export const CHORDS: TestChord[] = [
  { name: 'Do mayor', notes: [60, 64, 67], register: 'medios' },
  { name: 'La menor', notes: [57, 60, 64], register: 'medios' },
  { name: 'Fa mayor', notes: [53, 57, 60], register: 'medios' },
  { name: 'Do mayor, 1.ª inversión', notes: [64, 67, 72], register: 'medios' },
  { name: 'Sol mayor', notes: [43, 47, 50], register: 'graves' },
  { name: 'Re menor', notes: [50, 53, 57], register: 'graves' },
  { name: 'Fa mayor, 1.ª inversión', notes: [45, 48, 53], register: 'graves' },
  { name: 'Do mayor', notes: [72, 76, 79], register: 'agudos' },
  { name: 'La menor', notes: [69, 72, 76], register: 'agudos' },
  { name: 'Sol mayor, 1.ª inversión', notes: [71, 74, 79], register: 'agudos' },
]

export interface ChordAttempt extends TestChord {
  hits: number[]
  missed: number[]
  extras: number[]
  complete: boolean
}

export interface ChordTestRecord {
  date: string
  attempts: ChordAttempt[]
  device: { chordsSupported: boolean; latencyMs: number; noiseFloorDb: number; centsOffset: number; sensitivityDb: number }
}

export const noteName = (midi: number) => `${solfeo(midi)}${octaveOf(midi)}`

/** Compara el acorde pedido con lo que se oyó en la ventana del intento. */
export function scoreAttempt(chord: TestChord, detected: number[]): ChordAttempt {
  const heard = new Set(detected)
  const hits = chord.notes.filter((n) => heard.has(n))
  return {
    ...chord,
    hits,
    missed: chord.notes.filter((n) => !heard.has(n)),
    extras: [...heard].filter((n) => !chord.notes.includes(n)).sort((a, b) => a - b),
    complete: hits.length === chord.notes.length,
  }
}

function tally(attempts: ChordAttempt[]) {
  return {
    chords: attempts.length,
    complete: attempts.filter((a) => a.complete).length,
    notes: attempts.reduce((sum, a) => sum + a.notes.length, 0),
    hits: attempts.reduce((sum, a) => sum + a.hits.length, 0),
    extras: attempts.reduce((sum, a) => sum + a.extras.length, 0),
  }
}

export function summarize(attempts: ChordAttempt[]) {
  const registers: Register[] = ['graves', 'medios', 'agudos']
  return {
    total: tally(attempts),
    byRegister: registers
      .map((register) => ({ register, ...tally(attempts.filter((a) => a.register === register)) }))
      .filter((r) => r.chords > 0),
  }
}

const percent = (part: number, whole: number) => `${Math.round((part / whole) * 100)} %`
const list = (notes: number[]) => notes.map(noteName).join(' ') || '—'
const capitalized = (text: string) => text[0].toUpperCase() + text.slice(1)

/** Texto plano para copiar y pasar el resultado. */
export function report({ date, attempts, device }: ChordTestRecord) {
  const { total, byRegister } = summarize(attempts)
  return [
    `Prueba de acordes · ${new Date(date).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}`,
    `Acordes completos: ${total.complete} de ${total.chords} (${percent(total.complete, total.chords)})`,
    `Notas detectadas: ${total.hits} de ${total.notes} (${percent(total.hits, total.notes)})`,
    `Notas de más: ${total.extras}`,
    '',
    ...byRegister.map(
      (r) => `${capitalized(r.register)}: ${r.complete} de ${r.chords} completos · ${r.hits} de ${r.notes} notas · ${r.extras} de más`,
    ),
    '',
    ...attempts.map(
      (a) => `${a.name} (${list(a.notes)}): ${a.hits.length}/${a.notes.length} · faltaron: ${list(a.missed)} · de más: ${list(a.extras)}`,
    ),
    '',
    `Calibración: acordes ${device.chordsSupported ? 'sí' : 'no'} · latencia ${device.latencyMs} ms · ruido ${device.noiseFloorDb} dB · afinación ${Math.round(device.centsOffset)} cents · sensibilidad ${device.sensitivityDb} dB`,
  ].join('\n')
}
