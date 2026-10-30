import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import song from './data/odeToJoy.js'
import { buildLayout, octaveOf, solfeo } from './lib/notes.js'
import { Player } from './lib/player.js'
import { ensureAudio, playNote } from './lib/synth.js'
import Keyboard from './components/Keyboard.jsx'
import Waterfall from './components/Waterfall.jsx'
import Transport from './components/Transport.jsx'

const SOON_BEATS = 0.75
// La tecla se suelta un poco antes del final para que se vea la repetición de notas iguales.
const HOLD_RATIO = 0.88

const EMPTY = { ids: new Set(), keys: new Map(), soon: new Set(), sig: '' }

export default function App() {
  const layout = useMemo(() => buildLayout(...song.range), [])
  const player = useMemo(() => new Player(song), [])

  const [playing, setPlaying] = useState(false)
  const [tempo, setTempo] = useState(1)
  const [sectionId, setSectionId] = useState(null)
  const [repeat, setRepeat] = useState(true)
  const [sound, setSound] = useState(true)
  const [hands, setHands] = useState({ left: true, right: true })
  const [active, setActive] = useState(EMPTY)
  const [bar, setBar] = useState(1)

  const live = useRef({ sound, hands })
  live.current = { sound, hands }

  const section = song.sections.find((s) => s.id === sectionId) ?? null

  useEffect(() => player.onState(setPlaying), [player])
  useEffect(() => () => player.pause(), [player])

  useEffect(
    () =>
      player.onNote((e) => {
        const { sound, hands } = live.current
        if (sound && hands[e.hand]) playNote(e.midi, e.dur * player.secondsPerBeat(), e.hand === 'left' ? 0.55 : 0.8)
      }),
    [player],
  )

  useEffect(
    () =>
      player.onFrame((beat) => {
        const { hands } = live.current
        const ids = new Set()
        const keys = new Map()
        const soon = new Set()
        for (const e of song.events) {
          if (!hands[e.hand]) continue
          if (e.start <= beat && beat < e.start + e.dur * HOLD_RATIO) {
            ids.add(e.id)
            keys.set(e.midi, e.hand)
          } else if (e.start > beat && e.start - beat < SOON_BEATS) {
            soon.add(e.midi)
          }
        }
        const sig = [...ids].join(',') + '|' + [...soon].join(',')
        setActive((prev) => (prev.sig === sig ? prev : { ids, keys, soon, sig }))
        setBar(Math.min(song.bars, Math.max(1, Math.floor(beat / song.beatsPerBar) + 1)))
      }),
    [player, hands],
  )

  const togglePlay = useCallback(() => {
    ensureAudio()
    player.toggle()
  }, [player])

  const changeTempo = (t) => {
    setTempo(t)
    player.setTempo(t)
  }

  const changeSection = (id) => {
    setSectionId(id)
    const s = song.sections.find((x) => x.id === id)
    player.setLoop(s ? { start: s.start, end: s.end } : null, repeat)
  }

  const changeRepeat = (r) => {
    setRepeat(r)
    player.setLoop(player.loop, r)
  }

  const pressKey = useCallback(
    (midi) => {
      ensureAudio()
      if (live.current.sound) playNote(midi, 0.5)
    },
    [],
  )

  useEffect(() => {
    const onKey = (ev) => {
      if (ev.code === 'Space' && ev.target.tagName !== 'INPUT') {
        ev.preventDefault()
        togglePlay()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay])

  const nowPlaying = useMemo(() => {
    const byHand = { right: [], left: [] }
    for (const [midi, hand] of active.keys) byHand[hand].push(midi)
    const fmt = (arr) => arr.sort((a, b) => a - b).map((m) => `${solfeo(m)}${octaveOf(m)}`).join(' · ')
    return { right: fmt(byHand.right), left: fmt(byHand.left) }
  }, [active])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true" />
          <div>
            <h1>{song.title}</h1>
            <p>{song.composer}</p>
          </div>
        </div>
        <div className="status">
          <div className="bar-counter">
            <small>Compás</small>
            <strong>
              {bar}
              <em>/{song.bars}</em>
            </strong>
          </div>
        </div>
      </header>

      <div className="now-playing" aria-live="polite">
        <span className="np left">{nowPlaying.left || '—'}</span>
        <span className="np right">{nowPlaying.right || '—'}</span>
      </div>

      <main className="instrument">
        <Waterfall
          song={song}
          layout={layout}
          player={player}
          activeIds={active.ids}
          hands={hands}
          section={section}
        />
        <Keyboard layout={layout} active={active.keys} soon={active.soon} onPress={pressKey} />
      </main>

      <Transport
        song={song}
        player={player}
        playing={playing}
        onPlayToggle={togglePlay}
        tempo={tempo}
        onTempo={changeTempo}
        sectionId={sectionId}
        onSection={changeSection}
        repeat={repeat}
        onRepeat={changeRepeat}
        sound={sound}
        onSound={setSound}
        hands={hands}
        onHands={setHands}
      />
    </div>
  )
}
