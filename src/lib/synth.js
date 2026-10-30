import { midiToFreq } from './notes.js'

let ctx = null
let master = null

/** Debe llamarse desde un gesto del usuario (los navegadores bloquean el audio antes). */
export function ensureAudio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    const comp = ctx.createDynamicsCompressor()
    master = ctx.createGain()
    master.gain.value = 0.35
    master.connect(comp).connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
}

/** Sonido de piano sintético simple: dos osciladores con envolvente percusiva. */
export function playNote(midi, seconds = 0.6, velocity = 0.8) {
  if (!ctx) return
  const now = ctx.currentTime
  const freq = midiToFreq(midi)
  const len = Math.max(0.25, seconds)

  const env = ctx.createGain()
  env.gain.setValueAtTime(0, now)
  env.gain.linearRampToValueAtTime(velocity * 0.6, now + 0.008)
  env.gain.exponentialRampToValueAtTime(velocity * 0.22, now + 0.35)
  env.gain.setValueAtTime(velocity * 0.22, now + len)
  env.gain.exponentialRampToValueAtTime(0.0001, now + len + 0.4)

  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.setValueAtTime(Math.min(freq * 8, 9000), now)
  tone.frequency.exponentialRampToValueAtTime(Math.min(freq * 3, 5000), now + 0.5)

  const osc1 = ctx.createOscillator()
  osc1.type = 'triangle'
  osc1.frequency.value = freq
  const osc2 = ctx.createOscillator()
  osc2.type = 'sine'
  osc2.frequency.value = freq * 2
  const g2 = ctx.createGain()
  g2.gain.value = 0.25

  osc1.connect(tone)
  osc2.connect(g2).connect(tone)
  tone.connect(env).connect(master)

  const stop = now + len + 0.45
  osc1.start(now); osc2.start(now)
  osc1.stop(stop); osc2.stop(stop)
}
