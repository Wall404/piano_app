export const LEAD_IN = 2

/**
 * Reloj de reproducción en tiempos (beats), fuera de React.
 * Notifica cada frame y cada nota que empieza, para no re-renderizar a 60 fps.
 */
export class Player {
  constructor(song) {
    this.song = song
    this.beat = -LEAD_IN
    this.tempo = 1
    this.loop = null
    this.repeat = true
    this.playing = false
    this._frame = new Set()
    this._note = new Set()
    this._state = new Set()
    this._raf = 0
    this._last = 0
  }

  onFrame(fn) { this._frame.add(fn); fn(this.beat); return () => this._frame.delete(fn) }
  onNote(fn) { this._note.add(fn); return () => this._note.delete(fn) }
  onState(fn) { this._state.add(fn); return () => this._state.delete(fn) }

  secondsPerBeat() { return 60 / (this.song.bpm * this.tempo) }
  rangeStart() { return this.loop ? this.loop.start : 0 }
  rangeEnd() { return this.loop ? this.loop.end : this.song.totalBeats }

  play() {
    if (this.playing) return
    if (this.beat >= this.rangeEnd()) this.beat = this.rangeStart() - LEAD_IN
    this.playing = true
    this._last = performance.now()
    this._raf = requestAnimationFrame(this._tick)
    this._emitState()
  }

  pause() {
    if (!this.playing) return
    this.playing = false
    cancelAnimationFrame(this._raf)
    this._emitState()
  }

  toggle() { this.playing ? this.pause() : this.play() }
  restart() { this.seek(this.rangeStart() - LEAD_IN) }
  seek(beat) { this.beat = beat; this._emitFrame() }
  setTempo(t) { this.tempo = t }

  setLoop(range, repeat = this.repeat) {
    this.loop = range
    this.repeat = repeat
    const start = this.rangeStart()
    if (this.beat < start - LEAD_IN || this.beat >= this.rangeEnd()) this.seek(start - LEAD_IN)
  }

  _tick = (now) => {
    const dt = Math.min((now - this._last) / 1000, 0.1)
    this._last = now
    const prev = this.beat
    const next = prev + dt / this.secondsPerBeat()
    const end = this.rangeEnd()

    if (next >= end) {
      this._fire(prev, end)
      if (this.loop && this.repeat) {
        // Un tiempo de respiro antes de volver a empezar la sección.
        this.beat = this.loop.start - 1
      } else {
        this.beat = end
        this._emitFrame()
        this.pause()
        return
      }
    } else {
      this._fire(prev, next)
      this.beat = next
    }
    this._emitFrame()
    this._raf = requestAnimationFrame(this._tick)
  }

  _fire(from, to) {
    const min = this.loop ? this.loop.start : -Infinity
    for (const e of this.song.events) {
      if (e.start >= from && e.start < to && e.start >= min) this._note.forEach((fn) => fn(e))
    }
  }

  _emitFrame() { this._frame.forEach((fn) => fn(this.beat)) }
  _emitState() { this._state.forEach((fn) => fn(this.playing)) }
}
