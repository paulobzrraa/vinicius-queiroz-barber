import { ImageOff, Trash2, Upload } from 'lucide-react'
import { type FormEvent, useRef, useState } from 'react'

import { Button } from '@/components/ui'
import type { GalleryAspect, GalleryCategory } from '@/lib/database.types'
import {
  type GalleryImageRow,
  useDeleteGalleryImage,
  useGalleryImages,
  useSaveGalleryImage,
  useUploadGalleryPhoto,
} from '@/queries/gallery'
import { slugify } from '@/utils/slugify'

import { Field, Select, TextInput } from '../components/Field'
import { confirmDelete } from '../components/confirmDelete'

const categories: GalleryCategory[] = ['ambiente', 'corte', 'barba', 'detalhe']
const aspects: GalleryAspect[] = ['square', 'portrait', 'landscape']

function GalleryImageCard({ image }: { image: GalleryImageRow }) {
  const save = useSaveGalleryImage()
  const upload = useUploadGalleryPhoto()
  const remove = useDeleteGalleryImage()
  const fileInput = useRef<HTMLInputElement>(null)
  const [alt, setAlt] = useState(image.alt)
  const [category, setCategory] = useState(image.category)
  const [aspect, setAspect] = useState(image.aspect)

  function handleSaveFields(event: FormEvent) {
    event.preventDefault()
    save.mutate({ ...image, alt, category, aspect })
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const publicUrl = await upload.mutateAsync({ id: image.id, file })
    save.mutate({ ...image, alt, category, aspect, src: publicUrl })
  }

  return (
    <li className="flex flex-col gap-4 rounded-card border border-border bg-surface p-card sm:flex-row">
      <div className="relative size-24 shrink-0 overflow-hidden rounded-media bg-surface-raised">
        {image.src ? (
          <img src={image.src} alt={image.alt} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center">
            <ImageOff aria-hidden="true" className="size-6 text-muted" />
          </div>
        )}
      </div>

      <form onSubmit={handleSaveFields} className="flex-1 space-y-3">
        <Field label="Texto alternativo (alt)">
          <TextInput required value={alt} onChange={(event) => setAlt(event.target.value)} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Categoria">
            <Select
              value={category}
              onChange={(event) => setCategory(event.target.value as GalleryCategory)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Proporção">
            <Select
              value={aspect}
              onChange={(event) => setAspect(event.target.value as GalleryAspect)}
            >
              {aspects.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={save.isPending}>
            Salvar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            iconStart={<Upload />}
            onClick={() => fileInput.current?.click()}
            disabled={upload.isPending}
          >
            {upload.isPending ? 'Enviando…' : 'Trocar foto'}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            aria-label={`Remover ${image.alt}`}
            onClick={() => confirmDelete('esta foto') && remove.mutate(image.id)}
            className="ms-auto text-muted transition-control hover:text-foreground"
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        </div>
      </form>
    </li>
  )
}

function NewImageForm({ existingCount }: { existingCount: number }) {
  const save = useSaveGalleryImage()
  const [alt, setAlt] = useState('')
  const [category, setCategory] = useState<GalleryCategory>('ambiente')
  const [aspect, setAspect] = useState<GalleryAspect>('square')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const id = `${category}-${slugify(alt) || Date.now()}`
    save.mutate(
      { id, alt, category, aspect, src: null, sort_order: existingCount },
      { onSuccess: () => setAlt('') },
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-card border border-dashed border-border p-card"
    >
      <Field label="Texto alternativo (alt) da nova foto">
        <TextInput
          required
          placeholder="Ex.: Corte degradê"
          value={alt}
          onChange={(event) => setAlt(event.target.value)}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Categoria">
          <Select
            value={category}
            onChange={(event) => setCategory(event.target.value as GalleryCategory)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Proporção">
          <Select
            value={aspect}
            onChange={(event) => setAspect(event.target.value as GalleryAspect)}
          >
            {aspects.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <p className="text-caption text-muted">
        Cria o item sem foto; envie a foto depois pelo botão "Trocar foto" no card.
      </p>
      <Button type="submit" size="sm" variant="outline" disabled={save.isPending}>
        Adicionar item
      </Button>
    </form>
  )
}

export function GalleryEditor() {
  const { data: images } = useGalleryImages()

  return (
    <div className="max-w-2xl space-y-6">
      <ul className="space-y-4">
        {images?.map((image) => (
          <GalleryImageCard key={image.id} image={image} />
        ))}
      </ul>

      <NewImageForm existingCount={images?.length ?? 0} />
    </div>
  )
}
