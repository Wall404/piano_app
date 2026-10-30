import { parseNote } from './notes.js'

/**
 * Convierte una voz escrita como tokens secuenciales en eventos.
 * Token: "E4:1" (nota y duración en tiempos), "C3+E3+G3:4" (acorde) o "r:1" (silencio).
 */
function parseVoice(tokens, hand) {
  const events = []
  let t = 0
  for (const token of tokens) {
    const [pitch, dur] = token.split(':')
    const beats = Number(dur)
    if (pitch !== 'r') {
      for (const n of pitch.split('+')) {
        events.push({ midi: parseNote(n), start: t, dur: beats, hand })
      }
    }
    t += beats
  }
  return { events, length: t }
}

/** Formato interno de una partitura, independiente de su origen (MusicXML, MIDI, etc.). */
export function buildSong({ title, composer, bpm, beatsPerBar, right, left, sections }) {
  const r = parseVoice(right, 'right')
  const l = parseVoice(left, 'left')
  const events = [...r.events, ...l.events]
    .sort((a, b) => a.start - b.start || a.midi - b.midi)
    .map((e, i) => ({ ...e, id: i }))
  const totalBeats = Math.max(r.length, l.length)
  const midis = events.map((e) => e.midi)
  return {
    title,
    composer,
    bpm,
    beatsPerBar,
    events,
    totalBeats,
    bars: Math.ceil(totalBeats / beatsPerBar),
    range: [Math.min(...midis), Math.max(...midis)],
    sections: sections.map((s) => ({
      ...s,
      start: (s.fromBar - 1) * beatsPerBar,
      end: s.toBar * beatsPerBar,
    })),
  }
}
