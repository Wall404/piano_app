import type { Cursor, OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { PIANO_HIGH, PIANO_LOW } from '../model/notes'
import type { NoteEvent, Score } from '../model/types'

// OSMD numera las alturas una octava más abajo que MIDI.
const HALF_TONE_TO_MIDI = 12

export async function loadOsmd(container: HTMLElement, file: Blob): Promise<OpenSheetMusicDisplay> {
  const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay')
  const osmd = new OpenSheetMusicDisplay(container, {
    autoResize: false,
    backend: 'svg',
    drawTitle: false,
    drawingParameters: 'compacttight',
    followCursor: true,
  })
  await osmd.load(file)
  osmd.render()
  return osmd
}

/** Avanza el cursor hasta el compás pedido, contando compases con repeticiones incluidas. */
export function cursorToMeasure(cursor: Cursor, measure: number) {
  cursor.reset()
  let current = 1
  let index = cursor.Iterator.CurrentMeasureIndex
  while (current < measure && !cursor.Iterator.EndReached) {
    cursor.next()
    if (cursor.Iterator.CurrentMeasureIndex !== index) {
      index = cursor.Iterator.CurrentMeasureIndex
      current++
    }
  }
}

// ponytail: un solo tempo, el inicial; los cambios de tempo de la partitura se ignoran.
export function scoreFromOsmd(osmd: OpenSheetMusicDisplay, fileName: string): Score {
  const sheet = osmd.Sheet
  const bpm = sheet.DefaultStartTempoInBpm || 120
  const signature = sheet.SourceMeasures[0].ActiveTimeSignature
  const wholeSec = (4 * 60) / bpm

  const cursor = osmd.cursor
  cursor.reset()
  const notes: NoteEvent[] = []
  const measures: Score['measures'] = []
  let index = -1
  while (!cursor.Iterator.EndReached) {
    const time = cursor.Iterator.CurrentEnrolledTimestamp.RealValue * wholeSec
    if (cursor.Iterator.CurrentMeasureIndex !== index) {
      index = cursor.Iterator.CurrentMeasureIndex
      measures.push({ index: measures.length + 1, start: time })
    }
    for (const note of cursor.NotesUnderCursor()) {
      const tie = note.NoteTie
      if (note.isRest() || (tie && tie.Notes[0] !== note)) continue
      const midi = note.halfTone + HALF_TONE_TO_MIDI
      if (midi < PIANO_LOW || midi > PIANO_HIGH) continue
      const length = tie ? tie.Notes.reduce((sum, n) => sum + n.Length.RealValue, 0) : note.Length.RealValue
      const finger = Number(note.Fingering?.value)
      notes.push({
        midi,
        time,
        duration: length * wholeSec,
        hand: note.ParentStaff.Id === 1 ? 'R' : 'L',
        measure: measures.length,
        ...(finger >= 1 && finger <= 5 ? { finger } : {}),
      })
    }
    cursor.next()
  }
  cursor.reset()
  if (notes.length === 0) throw new Error('La partitura no tiene notas.')

  return {
    id: `${Date.now()}-${fileName}`,
    title: sheet.TitleString || fileName.replace(/\.[^.]+$/, ''),
    composer: sheet.ComposerString || undefined,
    bpm,
    timeSignature: [signature.Numerator, signature.Denominator],
    measures,
    notes: notes.sort((a, b) => a.time - b.time || a.midi - b.midi),
    source: { kind: 'musicxml', fileName },
  }
}

export async function fromMusicXml(file: File): Promise<Score> {
  // OSMD necesita dibujar para recorrer la partitura.
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-9999px;width:1000px'
  document.body.append(container)
  try {
    const osmd = await loadOsmd(container, file)
    osmd.enableOrDisableCursors(true)
    return scoreFromOsmd(osmd, file.name)
  } finally {
    container.remove()
  }
}
