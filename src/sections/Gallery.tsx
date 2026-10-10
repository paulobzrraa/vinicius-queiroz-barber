import { ChevronLeft, ChevronRight, Expand, ImageOff, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { fadeInUp, imageReveal } from '@/animations'
import { Container, Heading, IconButton, Reveal, Section, Text } from '@/components/ui'
import { sectionIds } from '@/data'
import type { GalleryAspect } from '@/lib/database.types'
import { type GalleryImageRow, useGalleryImages } from '@/queries/gallery'
import { cn } from '@/utils/cn'

const categoryLabels: Record<GalleryImageRow['category'], string> = {
  ambiente: 'Ambiente',
  corte: 'Corte',
  barba: 'Barba',
  detalhe: 'Detalhe',
}

/*
 * Cada proporção ocupa um espaço fixo no grid (a célula, não a imagem): o
 * tamanho do card não depende da imagem ter carregado, então trocar um
 * marcador por uma foto real nunca desloca o layout (CLS).
 */
const spanClasses: Record<GalleryAspect, string> = {
  square: '',
  portrait: 'row-span-2',
  landscape: 'col-span-2',
}

/** Conteúdo do card: a foto real, ou um marcador visual claramente identificável. */
function GalleryMedia({ image }: { image: GalleryImageRow }) {
  if (!image.src) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-surface-raised">
        <ImageOff aria-hidden="true" className="size-7 text-muted" />
        <Text size="caption" tone="muted">
          {categoryLabels[image.category]} · em breve
        </Text>
      </div>
    )
  }

  return (
    <img
      src={image.src}
      alt={image.alt}
      loading="lazy"
      decoding="async"
      className="h-full w-full object-cover transition-control motion-safe:group-hover:scale-105"
    />
  )
}

function GalleryCard({ image, onOpen }: { image: GalleryImageRow; onOpen: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      variants={imageReveal}
      aria-label={`Ver em tela cheia: ${image.alt}`}
      className="group block h-full w-full overflow-hidden rounded-media text-left"
    >
      <div className="relative h-full w-full">
        <GalleryMedia image={image} />

        {/* Overlay do hover/foco: legibilidade para a categoria e o ícone de expandir. */}
        <div className="absolute inset-0 flex items-end bg-gradient-scrim opacity-0 transition-control group-hover:opacity-100 group-focus-visible:opacity-100">
          <div className="flex w-full items-center justify-between gap-2 p-4">
            <Text size="small" className="font-medium">
              {categoryLabels[image.category]}
            </Text>
            <Expand aria-hidden="true" className="size-5" />
          </div>
        </div>
      </div>
    </motion.button>
  )
}

interface LightboxProps {
  images: GalleryImageRow[]
  index: number | null
  onClose: () => void
  onNavigate: (index: number) => void
}

/**
 * Lightbox sobre o <dialog> nativo: Esc, foco preso e página inerte vêm de
 * graça do navegador (mesma base do menu mobile). Setas do teclado e swipe
 * navegam entre as fotos; a animação de troca é da Motion.
 */
function Lightbox({ images, index, onClose, onNavigate }: LightboxProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const touchStartX = useRef<number | null>(null)
  const open = index !== null

  useEffect(() => {
    const element = dialog.current
    if (!element) return

    if (open && !element.open) {
      element.showModal()
      closeButton.current?.focus()
    } else if (!open && element.open) {
      element.close()
    }
  }, [open])

  const showPrev = useCallback(() => {
    if (index === null) return
    onNavigate((index - 1 + images.length) % images.length)
  }, [index, images.length, onNavigate])

  const showNext = useCallback(() => {
    if (index === null) return
    onNavigate((index + 1) % images.length)
  }, [index, images.length, onNavigate])

  // Setas do teclado, só enquanto o lightbox está aberto. O Esc já fecha
  // sozinho: é o comportamento nativo de um <dialog> aberto com showModal().
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') showPrev()
      if (event.key === 'ArrowRight') showNext()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, showPrev, showNext])

  const image = index !== null ? images[index] : null

  return (
    <dialog
      ref={dialog}
      aria-label="Foto em tela cheia"
      onClose={onClose}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none lightbox border-0 p-0"
    >
      {image && (
        <div className="relative flex h-full w-full items-center justify-center">
          <IconButton
            ref={closeButton}
            aria-label="Fechar"
            onClick={() => dialog.current?.close()}
            className="absolute top-4 right-4 z-10 lg:top-6 lg:right-6"
          >
            <X aria-hidden="true" className="size-5" />
          </IconButton>

          {images.length > 1 && (
            <>
              <IconButton
                aria-label="Foto anterior"
                onClick={showPrev}
                className="absolute top-1/2 left-2 z-10 -translate-y-1/2 lg:left-6"
              >
                <ChevronLeft aria-hidden="true" className="size-6" />
              </IconButton>
              <IconButton
                aria-label="Próxima foto"
                onClick={showNext}
                className="absolute top-1/2 right-2 z-10 -translate-y-1/2 lg:right-6"
              >
                <ChevronRight aria-hidden="true" className="size-6" />
              </IconButton>
            </>
          )}

          <div
            onTouchStart={(event) => {
              touchStartX.current = event.touches[0]?.clientX ?? null
            }}
            onTouchEnd={(event) => {
              const start = touchStartX.current
              touchStartX.current = null
              if (start === null) return

              const delta = (event.changedTouches[0]?.clientX ?? start) - start
              if (Math.abs(delta) < 50) return
              if (delta > 0) showPrev()
              else showNext()
            }}
            className="flex h-full w-full flex-col items-center justify-center gap-4 px-14 py-16 sm:px-20"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.figure
                key={image.id}
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={fadeInUp}
                className="flex w-full max-w-3xl flex-col items-center gap-4"
              >
                {image.src ? (
                  <img
                    src={image.src}
                    alt={image.alt}
                    className="max-h-[75vh] max-w-full rounded-media object-contain"
                  />
                ) : (
                  <div className="flex aspect-landscape max-h-[75vh] w-full flex-col items-center justify-center gap-3 rounded-media bg-surface-raised">
                    <ImageOff aria-hidden="true" className="size-10 text-muted" />
                    <Text tone="muted">{categoryLabels[image.category]} · foto em breve</Text>
                  </div>
                )}
                <Text as="p" size="small" tone="muted">
                  {image.alt} — {index !== null ? index + 1 : 0} / {images.length}
                </Text>
              </motion.figure>
            </AnimatePresence>
          </div>
        </div>
      )}
    </dialog>
  )
}

/** Galeria de fotos: ambiente, cortes, barba e detalhes, com lightbox. */
export function Gallery() {
  const { data: galleryImages } = useGalleryImages()
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  if (!galleryImages) return null

  return (
    <Section id={sectionIds.gallery} aria-labelledby={`${sectionIds.gallery}-title`}>
      <Container>
        <Heading id={`${sectionIds.gallery}-title`} className="text-center">
          Galeria
        </Heading>

        <Reveal
          as="ul"
          amount={0.15}
          className="mt-block grid grid-flow-dense auto-rows-[11rem] grid-cols-2 gap-4 sm:auto-rows-[13rem] sm:grid-cols-3 lg:auto-rows-[15rem] lg:grid-cols-4 lg:gap-6"
        >
          {galleryImages.map((image, index) => (
            <li key={image.id} className={cn('relative', spanClasses[image.aspect])}>
              <GalleryCard image={image} onOpen={() => setActiveIndex(index)} />
            </li>
          ))}
        </Reveal>
      </Container>

      <Lightbox
        images={galleryImages}
        index={activeIndex}
        onClose={() => setActiveIndex(null)}
        onNavigate={setActiveIndex}
      />
    </Section>
  )
}
