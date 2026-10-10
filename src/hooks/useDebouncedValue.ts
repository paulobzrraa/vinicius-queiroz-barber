import { useEffect, useState } from 'react'

/** Devolve `value` só depois de ele ficar parado por `delayMs` (para não consultar a cada tecla digitada). */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
