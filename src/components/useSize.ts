import { useLayoutEffect, useRef, useState } from 'react'

/** Tamaño en píxeles de un elemento, actualizado cuando cambia. */
export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    ro.observe(ref.current!)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}
