import { ImageOff, Trash2, Upload } from 'lucide-react'
import { type FormEvent, useRef, useState } from 'react'

import { Button } from '@/components/ui'
import {
  type ProfessionalRow,
  useDeleteProfessional,
  useSaveProfessional,
  useUploadProfessionalPhoto,
} from '@/queries/professionals'

import { Disclosure } from '../../components/Disclosure'
import { Field, TextArea, TextInput } from '../../components/Field'
import { ScheduleExceptionsEditor } from '../../components/ScheduleExceptionsEditor'
import { ProfessionalHoursEditor } from './ProfessionalHoursEditor'
import { ProfessionalServicesEditor } from './ProfessionalServicesEditor'
import { confirmDelete } from '../../components/confirmDelete'

/** BL-088 a BL-091: um profissional — dados básicos, foto, expediente, exceções e serviços. */
export function ProfessionalCard({ professional }: { professional: ProfessionalRow }) {
  const save = useSaveProfessional()
  const upload = useUploadProfessionalPhoto()
  const remove = useDeleteProfessional()
  const fileInput = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(professional.name)
  const [bio, setBio] = useState(professional.bio ?? '')
  const [active, setActive] = useState(professional.active)

  function handleSaveFields(event: FormEvent) {
    event.preventDefault()
    save.mutate({ ...professional, name, bio: bio || null, active })
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const publicUrl = await upload.mutateAsync({ id: professional.id, file })
    save.mutate({ ...professional, name, bio: bio || null, active, photo_url: publicUrl })
  }

  return (
    <li className="rounded-card border border-border bg-surface p-card">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-media bg-surface-raised">
          {professional.photo_url ? (
            <img src={professional.photo_url} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center">
              <ImageOff aria-hidden="true" className="size-5 text-muted" />
            </div>
          )}
        </div>

        <form onSubmit={handleSaveFields} className="flex-1 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome">
              <TextInput required value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <label className="mt-6 flex items-center gap-2 text-small text-muted">
              <input
                type="checkbox"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
              />
              Ativo (aparece no agendamento)
            </label>
          </div>

          <Field label="Bio curta" hint="Opcional.">
            <TextArea value={bio} onChange={(event) => setBio(event.target.value)} />
          </Field>

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
              aria-label={`Remover ${professional.name}`}
              onClick={() =>
                confirmDelete(`o profissional ${professional.name}`) &&
                remove.mutate(professional.id)
              }
              className="ms-auto text-muted transition-control hover:text-foreground"
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </button>
          </div>
        </form>
      </div>

      <div className="mt-6 border-t border-border pt-2">
        <Disclosure label="Expediente">
          <ProfessionalHoursEditor professionalId={professional.id} />
        </Disclosure>

        <Disclosure label="Folgas e exceções">
          <ScheduleExceptionsEditor professionalId={professional.id} />
        </Disclosure>

        <Disclosure label="Serviços que realiza">
          <ProfessionalServicesEditor professionalId={professional.id} />
        </Disclosure>
      </div>
    </li>
  )
}
