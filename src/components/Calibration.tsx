import { useRef, useState } from 'react'
import { runCalibration, STEP_COUNT, type CalibrationProfile, type CalibrationStep } from '../eval/calibrate'
import { playClick, prepareAudio } from '../engine/transport'
import { saveCalibration } from '../storage/db'

function warnings(p: CalibrationProfile) {
  const list: string[] = []
  if (p.registerGain.low) list.push('No oí bien los graves: acercá el teléfono a los parlantes.')
  if (p.registerGain.mid) list.push('No oí bien el registro medio.')
  if (p.registerGain.high) list.push('No oí bien los agudos.')
  if (!p.chordsSupported) list.push('No detecté el acorde completo: en acordes voy a pedirte solo una nota.')
  return list
}

/** Asistente de calibración del micrófono. */
export default function Calibration({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [step, setStep] = useState<CalibrationStep | null>(null)
  const [profile, setProfile] = useState<CalibrationProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abort = useRef(new AbortController())

  const start = async () => {
    setError(null)
    setStep({ index: 1, title: 'Preparando', detail: 'Abriendo el micrófono…' })
    try {
      await prepareAudio()
      const result = await runCalibration(playClick, setStep, abort.current.signal)
      if (result) {
        await saveCalibration(result)
        setProfile(result)
      }
    } catch (err) {
      setStep(null)
      const denied = err instanceof DOMException && err.name === 'NotAllowedError'
      setError(denied ? 'Permití el micrófono en el navegador para calibrar.' : err instanceof Error ? err.message : 'No se pudo calibrar.')
    }
  }

  return (
    <div className="calibration" role="dialog" aria-label="Calibración del micrófono">
      <div className="calibration-card">
        {profile ? (
          <>
            <h2>Calibración lista</h2>
            <p>Afinación: {Math.round(profile.centsOffset)} cents · Latencia: {profile.latencyMs} ms · Ruido: {profile.noiseFloorDb} dB</p>
            {warnings(profile).map((w) => <p key={w} className="warn">{w}</p>)}
            <button className="primary" onClick={onDone}>Empezar a tocar</button>
          </>
        ) : step ? (
          <>
            <small>Paso {step.index} de {STEP_COUNT}</small>
            <h2>{step.title}</h2>
            <p>{step.detail}</p>
            <div className="calibration-bar"><span style={{ width: `${(step.index / STEP_COUNT) * 100}%` }} /></div>
            <button className="secondary" onClick={() => { abort.current.abort(); onCancel() }}>Cancelar</button>
          </>
        ) : (
          <>
            <h2>Calibremos el micrófono</h2>
            <p>Son unos dos minutos. Apoyá el teléfono cerca de los parlantes del piano, en el mismo lugar donde vas a practicar.</p>
            {error && <p className="warn" role="alert">{error}</p>}
            <button className="primary" onClick={() => void start()}>Empezar</button>
            <button className="secondary" onClick={onCancel}>Ahora no</button>
          </>
        )}
      </div>
    </div>
  )
}
