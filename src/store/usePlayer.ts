import { create } from 'zustand'
import type { Result } from '../eval/match'
import type { Hand, MeasureRange } from '../model/types'

export interface PlayerState {
  playing: boolean
  loadingAudio: boolean
  waiting: boolean // modo espera: detenido hasta que se toque el acorde
  tempoPct: number
  range: MeasureRange | null
  repeat: boolean
  sound: boolean
  metronome: boolean
  hands: Record<Hand, boolean>
  waitMode: boolean
  allKeys: boolean
  position: number // segundos a tempo original; cambia en cada frame
  measure: number
  activeIds: Set<number> // índices en score.notes
  active: Map<number, Hand>
  soon: Set<number>
  played: Set<number> // notas apretadas en el teclado MIDI
  midiDevices: string[] | null // null: sin conectar
  midiError: string | null
  result: Result | null // devolución de la última pasada
  view: 'falls' | 'score'
}

export const initialState: PlayerState = {
  playing: false,
  loadingAudio: false,
  waiting: false,
  tempoPct: 100,
  range: null,
  repeat: true,
  sound: true,
  metronome: false,
  hands: { L: true, R: true },
  waitMode: false,
  allKeys: false,
  position: 0,
  measure: 1,
  activeIds: new Set(),
  active: new Map(),
  soon: new Set(),
  played: new Set(),
  midiDevices: null,
  midiError: null,
  result: null,
  view: 'falls',
}

export const usePlayer = create<PlayerState>(() => initialState)
