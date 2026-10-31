import { describe, expect, it } from 'vitest'
import { centsFrom, meanLatencyMs, median } from '../src/eval/calibrate'
import { noteLevels } from '../src/eval/mic'
import { peakBin } from '../src/eval/peak'

describe('calibración', () => {
  it('mide el desvío en cents', () => {
    expect(centsFrom(440)).toBeCloseTo(0)
    expect(centsFrom(432.4)).toBeCloseTo(-30, 0)
  })

  it('toma la mediana', () => {
    expect(median([442, 300, 441])).toBe(441)
  })

  it('interpola el pico entre dos bins', () => {
    const spectrum = new Float32Array(20).fill(-90)
    spectrum[9] = -40
    spectrum[10] = -30
    spectrum[11] = -40
    expect(peakBin(spectrum, 5, 15)).toBeCloseTo(10)
    spectrum[11] = -34
    expect(peakBin(spectrum, 5, 15)).toBeGreaterThan(10)
  })

  it('promedia la latencia ignorando golpes lejanos', () => {
    expect(meanLatencyMs([1000, 2000], [1200, 2300, 9000])).toBe(250)
    expect(meanLatencyMs([1000], [])).toBeNull()
  })

  it('un piano desafinado se lee con el desvío calibrado', () => {
    const spectrum = new Float32Array(8192).fill(-100)
    const flat = 440 * 2 ** (-60 / 1200)
    spectrum[Math.round((flat * 16384) / 48000)] = -30
    expect(noteLevels(spectrum, 48000, 69, 69, 0)[0]).toBe(-100)
    expect(noteLevels(spectrum, 48000, 69, 69, -60)[0]).toBe(-30)
  })
})
