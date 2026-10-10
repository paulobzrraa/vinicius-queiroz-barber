import { useEffect, useState, type RefObject } from 'react'

/**
 * true quando a página saiu do topo. Observa uma sentinela posicionada no
 * início do documento, em vez de escutar o scroll: não custa nada na thread
 * principal durante a rolagem.
 */
export function useScrolled(sentinel: RefObject<Element | null>) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const element = sentinel.current
    if (!element) return

    const observer = new IntersectionObserver(([entry]) => {
      if (entry) setScrolled(!entry.isIntersecting)
    })
    observer.observe(element)

    return () => observer.disconnect()
  }, [sentinel])

  return scrolled
}
