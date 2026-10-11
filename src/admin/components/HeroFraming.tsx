import { type KeyboardEvent, type PointerEvent, type SyntheticEvent, useRef, useState } from 'react'

import { cn } from '@/utils/cn'
import {
  DEFAULT_HERO_FOCUS,
  heroFocusStyle,
  type HeroFocus,
  MAX_HERO_ZOOM,
  type PhotoSize,
  panHeroFocus,
} from '@/utils/heroPhoto'

/** Mesmas proporções das telas em que o Hero aparece (desktop acima de 768px, mobile abaixo). */
const DESKTOP_FRAME: PhotoSize = { width: 1440, height: 900 }
const MOBILE_FRAME: PhotoSize = { width: 390, height: 844 }

/** Quanto cada seta do teclado move a foto, em %. */
const KEY_STEP = 2

type Device = 'desktop' | 'mobile'

interface HeroFramingProps {
  imageUrl: string
  desktop: HeroFocus
  mobile: HeroFocus
  onChange: (device: Device, focus: HeroFocus) => void
}

/**
 * Prévia do enquadramento da foto do Hero, lado a lado para desktop e mobile.
 * Arrastar a foto (ou as setas do teclado) muda o foco; o zoom fica no slider.
 * Usa heroFocusStyle, o mesmo estilo do site, então a prévia mostra o que o
 * visitante vê.
 */
export function HeroFraming({ imageUrl, desktop, mobile, onChange }: HeroFramingProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4">
        <FramePreview
          label="Desktop"
          frame={DESKTOP_FRAME}
          imageUrl={imageUrl}
          focus={desktop}
          onChange={(focus) => onChange('desktop', focus)}
          className="min-w-0 flex-1"
        />
        <FramePreview
          label="Mobile"
          frame={MOBILE_FRAME}
          imageUrl={imageUrl}
          focus={mobile}
          onChange={(focus) => onChange('mobile', focus)}
          className="w-36 shrink-0"
        />
      </div>
      <p className="text-caption text-muted">
        Arraste a foto para enquadrar. As alterações valem para o site depois de Salvar.
      </p>
    </div>
  )
}

interface FramePreviewProps {
  label: string
  frame: PhotoSize
  imageUrl: string
  focus: HeroFocus
  onChange: (focus: HeroFocus) => void
  className?: string
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value))
}

function FramePreview({ label, frame, imageUrl, focus, onChange, className }: FramePreviewProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [photo, setPhoto] = useState<PhotoSize | null>(null)
  // Guarda o ponto e o foco do início do arrasto: cada movimento recalcula a partir daí.
  const drag = useRef<{ x: number; y: number; start: HeroFocus } | null>(null)

  function handleLoad(event: SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth, naturalHeight } = event.currentTarget
    setPhoto({ width: naturalWidth, height: naturalHeight })
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!photo) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY, start: focus }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const origin = drag.current
    const box = frameRef.current?.getBoundingClientRect()
    if (!origin || !photo || !box) return
    onChange(
      panHeroFocus(
        origin.start,
        { dx: event.clientX - origin.x, dy: event.clientY - origin.y },
        photo,
        { width: box.width, height: box.height },
      ),
    )
  }

  function endDrag() {
    drag.current = null
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Setas movem a foto na direção indicada, como o arrastar.
    const moves: Record<string, { x?: number; y?: number }> = {
      ArrowLeft: { x: KEY_STEP },
      ArrowRight: { x: -KEY_STEP },
      ArrowUp: { y: KEY_STEP },
      ArrowDown: { y: -KEY_STEP },
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    onChange({
      ...focus,
      x: clampPercent(focus.x + (move.x ?? 0)),
      y: clampPercent(focus.y + (move.y ?? 0)),
    })
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div
        ref={frameRef}
        tabIndex={0}
        aria-label={`Enquadramento ${label}: arraste a foto ou use as setas do teclado`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={handleKeyDown}
        style={{ aspectRatio: `${frame.width} / ${frame.height}` }}
        className="relative cursor-grab touch-none overflow-hidden rounded-media border border-border bg-surface select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:cursor-grabbing"
      >
        <img
          src={imageUrl}
          alt=""
          draggable={false}
          onLoad={handleLoad}
          style={heroFocusStyle(focus)}
          className="pointer-events-none absolute inset-0 size-full object-cover"
        />
        {/* Mesmas camadas do Hero no site: escurecimento e leitura do header. */}
        <div className="absolute inset-0 bg-background/55" />
        <div className="absolute inset-x-0 top-0 h-[60%] bg-gradient-scrim-top" />
      </div>

      <div className="flex items-center justify-between gap-2 text-caption text-muted">
        <span>{label}</span>
        <span>Zoom {Math.round(focus.zoom * 100)}%</span>
      </div>
      <input
        type="range"
        min={1}
        max={MAX_HERO_ZOOM}
        step={0.05}
        value={focus.zoom}
        aria-label={`Zoom da foto no ${label}`}
        onChange={(event) => onChange({ ...focus, zoom: Number(event.target.value) })}
        className="w-full accent-accent"
      />
      <button
        type="button"
        onClick={() => onChange(DEFAULT_HERO_FOCUS)}
        className="text-caption text-muted transition-control hover:text-foreground"
      >
        Centralizar
      </button>
    </div>
  )
}
