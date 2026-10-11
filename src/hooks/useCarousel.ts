import { useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface UseCarouselOptions {
  itemCount: number
  autoplay?: boolean
  autoplayInterval?: number
}

/**
 * Lógica de um carousel com rolagem nativa (scroll-snap): quem chama só
 * precisa renderizar a trilha (`<ul ref={trackRef}>`) e os controles (setas,
 * bolinhas) usando o que este hook devolve. Extraído da seção de Depoimentos
 * (BL-024) pra ser reaproveitado também em Serviços, sem duplicar a parte
 * de estado (a única com pegadinha de verdade).
 *
 * Um `IntersectionObserver` descobre qual item está visível — funciona tanto
 * pro swipe manual (touch) quanto pra navegação programática (setas,
 * bolinhas, autoplay) — e o autoplay (opcional) para sozinho com
 * `prefers-reduced-motion`, com 1 item só, ou enquanto o mouse/foco estiver
 * em cima (WCAG 2.2.2).
 */
export function useCarousel({
  itemCount,
  autoplay = false,
  autoplayInterval = 7000,
}: UseCarouselOptions) {
  const reducedMotion = useReducedMotion()
  const trackRef = useRef<HTMLUListElement>(null)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(autoplay)
  const [paused, setPaused] = useState(false)

  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(itemCount > 1)

  // A posição de rolagem é a fonte da verdade: com vários cards visíveis (desktop), os últimos
  // nunca chegam ao início da trilha, então "item i no início" não serve pra saber onde estamos.
  useEffect(() => {
    const track = trackRef.current
    if (!track || itemCount === 0) return

    function sync() {
      if (!track) return
      const children = Array.from(track.children) as HTMLElement[]
      const maxScroll = track.scrollWidth - track.clientWidth
      const atStart = track.scrollLeft <= 1
      const atEnd = track.scrollLeft >= maxScroll - 1

      let nearest = 0
      let nearestDistance = Infinity
      children.forEach((child, i) => {
        const distance = Math.abs(child.offsetLeft - track.offsetLeft - track.scrollLeft)
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearest = i
        }
      })

      setIndex(atStart ? 0 : atEnd ? children.length - 1 : nearest)
      setCanPrev(!atStart)
      setCanNext(!atEnd)
    }

    // No máximo uma medição por quadro: o scroll dispara vários eventos por quadro, e cada medição
    // lê a posição de todos os cards.
    let frame = 0
    function schedule() {
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0
          sync()
        })
      }
    }

    sync()
    track.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      track.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [itemCount])

  const scrollToIndex = useCallback(
    (i: number) => {
      const track = trackRef.current
      if (!track) return
      const target = track.children[Math.max(0, Math.min(i, track.children.length - 1))] as
        HTMLElement | undefined
      if (!target) return
      track.scrollTo({
        left: target.offsetLeft - track.offsetLeft,
        behavior: reducedMotion ? 'auto' : 'smooth',
      })
    },
    [reducedMotion],
  )

  // Setas: andam um card a partir da posição real de rolagem (não do índice), então não travam
  // nas pontas nem com cliques seguidos durante a animação.
  const step = useCallback(
    (direction: 1 | -1) => {
      const track = trackRef.current
      if (!track) return
      const children = Array.from(track.children) as HTMLElement[]
      const positions = children.map((child) => child.offsetLeft - track.offsetLeft)
      const current = track.scrollLeft
      const target =
        direction === 1
          ? positions.find((position) => position > current + 4)
          : [...positions].reverse().find((position) => position < current - 4)
      track.scrollTo({
        left: target ?? (direction === 1 ? track.scrollWidth : 0),
        behavior: reducedMotion ? 'auto' : 'smooth',
      })
    },
    [reducedMotion],
  )
  const next = useCallback(() => step(1), [step])
  const prev = useCallback(() => step(-1), [step])

  useEffect(() => {
    if (!playing || paused || reducedMotion || itemCount <= 1) return
    const id = setInterval(() => scrollToIndex((index + 1) % itemCount), autoplayInterval)
    return () => clearInterval(id)
  }, [playing, paused, reducedMotion, itemCount, index, scrollToIndex, autoplayInterval])

  return {
    trackRef,
    index,
    scrollToIndex,
    next,
    prev,
    canPrev,
    canNext,
    playing,
    setPlaying,
    reducedMotion,
    pauseHandlers: {
      onPointerEnter: () => setPaused(true),
      onPointerLeave: () => setPaused(false),
      onFocusCapture: () => setPaused(true),
      onBlurCapture: () => setPaused(false),
    },
  }
}
