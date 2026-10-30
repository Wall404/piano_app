export interface MidiNote {
  midi: number
  on: boolean
}

/** Interpreta un mensaje MIDI. Note On con velocidad 0 equivale a Note Off. */
export function parseMidiMessage(data: ArrayLike<number>): MidiNote | null {
  const type = data[0] & 0xf0
  if (type === 0x90) return { midi: data[1], on: data[2] > 0 }
  if (type === 0x80) return { midi: data[1], on: false }
  return null
}

/** Escucha todas las entradas MIDI, incluidas las que se conecten después. */
export async function connectMidi(
  onNote: (note: MidiNote) => void,
  onDevices: (names: string[]) => void,
): Promise<void> {
  if (!('requestMIDIAccess' in navigator)) {
    throw new Error('Web MIDI no disponible: usá Chrome con HTTPS o localhost.')
  }
  const access = await navigator.requestMIDIAccess()
  const bind = () => {
    access.inputs.forEach((input) => {
      input.onmidimessage = (e) => {
        const note = e.data && parseMidiMessage(e.data)
        if (note) onNote(note)
      }
    })
    onDevices([...access.inputs.values()].map((i) => i.name ?? 'Teclado MIDI'))
  }
  bind()
  access.onstatechange = bind
}
