import type { Score } from '../model/types'

export async function importFile(file: File): Promise<Score> {
  if (/\.midi?$/i.test(file.name)) {
    const { fromMidi } = await import('./midi')
    return fromMidi(await file.arrayBuffer(), file.name)
  }
  if (/\.(mxl|musicxml|xml)$/i.test(file.name)) {
    const { fromMusicXml } = await import('./musicxml')
    return fromMusicXml(file)
  }
  throw new Error('Formato no soportado: usá .musicxml, .xml, .mxl o .mid.')
}
