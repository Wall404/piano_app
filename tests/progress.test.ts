import { describe, expect, it } from 'vitest'
import { CLEAN_LOOPS, nextTempo, worstMeasures, type Result } from '../src/eval/match'

const result = (over: Partial<Result> = {}): Result => ({
  total: 4,
  hits: 4,
  wrong: 0,
  missed: 0,
  avgOffsetMs: 0,
  errorsByMeasure: {},
  ...over,
})

describe('subida de tempo', () => {
  it('sube 5 % recién al completar los loops limpios', () => {
    expect(nextTempo(0, result(), 80)).toEqual({ cleanLoops: 1, tempoPct: 80 })
    expect(nextTempo(CLEAN_LOOPS - 1, result(), 80)).toEqual({ cleanLoops: 0, tempoPct: 85 })
  })

  it('un error en cualquier sentido reinicia la cuenta', () => {
    expect(nextTempo(2, result({ missed: 1 }), 80)).toEqual({ cleanLoops: 0, tempoPct: 80 })
    expect(nextTempo(2, result({ wrong: 1 }), 80)).toEqual({ cleanLoops: 0, tempoPct: 80 })
  })

  it('no pasa del tope', () => {
    expect(nextTempo(CLEAN_LOOPS - 1, result(), 150).tempoPct).toBe(150)
  })
})

describe('compases con más errores', () => {
  it('suma las pasadas y se queda con los peores', () => {
    const worst = worstMeasures([
      result({ errorsByMeasure: { 1: 1, 2: 3 } }),
      result({ errorsByMeasure: { 2: 1, 3: 2, 4: 1 } }),
    ])
    expect(worst).toEqual([
      { measure: 2, errors: 4 },
      { measure: 3, errors: 2 },
      { measure: 1, errors: 1 },
    ])
  })
})
