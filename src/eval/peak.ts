/** Bin del pico entre `from` y `to`, con interpolación parabólica. */
export function peakBin(spectrum: Float32Array, from: number, to: number): number {
  let best = from
  for (let i = from; i <= to; i++) if (spectrum[i] > spectrum[best]) best = i
  const [a, b, c] = [spectrum[best - 1], spectrum[best], spectrum[best + 1]]
  const denominator = a - 2 * b + c
  return denominator === 0 ? best : best + (0.5 * (a - c)) / denominator
}
