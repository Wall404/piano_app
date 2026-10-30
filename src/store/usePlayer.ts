import { create } from 'zustand'
import type { Hand } from '../model/types'

export interface PlayerState {
  playing: boolean
  loadingAudio: boolean
  waiting: boolean // modo espera: detenido hasta que se toque el acorde
  tempoPct: number
  sectionId: string | null
  repeat: boolean
  sound: boolean
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
}

export const usePlayer = create<PlayerState>(() => ({
  playing: false,
  loadingAudio: false,
  waiting: false,
  tempoPct: 100,
  sectionId: null,
  repeat: true,
  sound: true,
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
}))
