import { Upload } from 'lucide-react'
import { type FormEvent, useRef, useState } from 'react'

import { Button } from '@/components/ui'
import type { Database } from '@/lib/database.types'
import {
  useSiteSettings,
  useUpdateSiteSettings,
  useUploadAboutGif,
  useUploadHeroPhoto,
} from '@/queries/site'

import { Field, TextArea, TextInput } from '../components/Field'
import { confirmDelete } from '../components/confirmDelete'

type SiteSettings = Database['public']['Tables']['site_settings']['Row']

function SiteForm({ site }: { site: SiteSettings }) {
  const update = useUpdateSiteSettings()
  const uploadHeroPhoto = useUploadHeroPhoto()
  const uploadAboutGif = useUploadAboutGif()
  const fileInput = useRef<HTMLInputElement>(null)
  const gifInput = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    name: site.name,
    tagline: site.tagline ?? '',
    description: site.description ?? '',
    url: site.url ?? '',
    aboutBody: site.about_body ?? '',
    heroImageUrl: site.hero_image_url ?? '',
    aboutGifUrl: site.about_gif_url ?? '',
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    update.mutate({
      name: form.name,
      tagline: form.tagline || null,
      description: form.description || null,
      url: form.url || null,
      about_body: form.aboutBody || null,
      hero_image_url: form.heroImageUrl || null,
      about_gif_url: form.aboutGifUrl || null,
    })
  }

  async function handleHeroFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const publicUrl = await uploadHeroPhoto.mutateAsync(file)
    setForm((current) => ({ ...current, heroImageUrl: publicUrl }))
    update.mutate({ name: form.name, hero_image_url: publicUrl })
  }

  async function handleGifFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const publicUrl = await uploadAboutGif.mutateAsync(file)
    setForm((current) => ({ ...current, aboutGifUrl: publicUrl }))
    update.mutate({ name: form.name, about_gif_url: publicUrl })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl">
      <div className="space-y-5">
        <h3 className="text-small font-semibold text-foreground">Identidade</h3>
        <Field label="Nome do site">
          <TextInput
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </Field>

        <Field
          label="Slogan"
          hint="Frase curta de posicionamento. Deixe em branco se ainda não tiver."
        >
          <TextInput
            value={form.tagline}
            onChange={(event) => setForm({ ...form, tagline: event.target.value })}
          />
        </Field>
      </div>

      <div className="mt-6 space-y-5 border-t border-border pt-6">
        <h3 className="text-small font-semibold text-foreground">SEO e produção</h3>
        <Field label="Descrição institucional" hint="Usada em SEO e compartilhamento (Open Graph).">
          <TextInput
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </Field>

        <Field label="URL de produção" hint="Ex.: https://seudominio.com.br (sem barra no final).">
          <TextInput
            type="url"
            value={form.url}
            onChange={(event) => setForm({ ...form, url: event.target.value })}
          />
        </Field>
      </div>

      <div className="mt-6 space-y-5 border-t border-border pt-6">
        <h3 className="text-small font-semibold text-foreground">Sobre Nós</h3>
        <Field
          label="Texto de Sobre Nós"
          hint="Aparece na seção Sobre Nós. Some enquanto estiver vazio."
        >
          <TextArea
            value={form.aboutBody}
            onChange={(event) => setForm({ ...form, aboutBody: event.target.value })}
          />
        </Field>

        <Field
          label="GIF de Sobre Nós"
          hint="Aparece ao lado do texto, na lateral direita. Sem corte: a altura acompanha o arquivo enviado."
        >
          <div className="mt-1 space-y-3">
            {form.aboutGifUrl && (
              <img src={form.aboutGifUrl} alt="" className="h-32 rounded-media object-contain" />
            )}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                iconStart={<Upload />}
                onClick={() => gifInput.current?.click()}
                disabled={uploadAboutGif.isPending}
              >
                {uploadAboutGif.isPending
                  ? 'Enviando…'
                  : form.aboutGifUrl
                    ? 'Trocar GIF'
                    : 'Enviar GIF'}
              </Button>
              {form.aboutGifUrl && (
                <button
                  type="button"
                  className="text-caption text-muted transition-control hover:text-foreground"
                  onClick={() => {
                    if (!confirmDelete('o GIF')) return
                    setForm({ ...form, aboutGifUrl: '' })
                    update.mutate({ name: form.name, about_gif_url: null })
                  }}
                >
                  Remover GIF
                </button>
              )}
            </div>
            <input
              ref={gifInput}
              type="file"
              accept="image/gif"
              className="hidden"
              onChange={handleGifFileChange}
            />
          </div>
        </Field>
      </div>

      <div className="mt-6 space-y-5 border-t border-border pt-6">
        <h3 className="text-small font-semibold text-foreground">Hero</h3>
        <Field
          label="Foto de fundo do Hero"
          hint="Some para o fundo gráfico (sem foto) enquanto estiver vazio."
        >
          <div className="mt-1 space-y-3">
            {form.heroImageUrl && (
              <img
                src={form.heroImageUrl}
                alt=""
                className="h-32 w-full rounded-media object-cover"
              />
            )}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                iconStart={<Upload />}
                onClick={() => fileInput.current?.click()}
                disabled={uploadHeroPhoto.isPending}
              >
                {uploadHeroPhoto.isPending ? 'Enviando…' : 'Trocar foto'}
              </Button>
              {form.heroImageUrl && (
                <button
                  type="button"
                  className="text-caption text-muted transition-control hover:text-foreground"
                  onClick={() => {
                    if (!confirmDelete('a foto')) return
                    setForm({ ...form, heroImageUrl: '' })
                    update.mutate({ name: form.name, hero_image_url: null })
                  }}
                >
                  Remover foto
                </button>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleHeroFileChange}
            />
          </div>
        </Field>
      </div>

      <div className="mt-6 border-t border-border pt-6">
        <Button
          type="submit"
          disabled={update.isPending || uploadHeroPhoto.isPending || uploadAboutGif.isPending}
        >
          {update.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
        {update.isSuccess && <span className="ms-3 text-small text-muted">Salvo.</span>}
        {update.isError && (
          <span className="ms-3 text-small text-muted">
            Não foi possível salvar: {update.error.message}
          </span>
        )}
      </div>
    </form>
  )
}

export function SiteEditor() {
  const { data: site } = useSiteSettings()
  if (!site) return null
  return <SiteForm site={site} />
}
