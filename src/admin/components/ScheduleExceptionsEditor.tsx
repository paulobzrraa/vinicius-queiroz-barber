import { Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { Button } from '@/components/ui'
import {
  useDeleteScheduleException,
  useSaveScheduleException,
  useScheduleExceptions,
} from '@/queries/professionals'

import { DateTimeInput, Field, TextInput } from './Field'
import { confirmDelete } from './confirmDelete'

function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

interface ScheduleExceptionsEditorProps {
  /** null = exceção da barbearia inteira (BL-094); com id, só daquele profissional (BL-090). */
  professionalId: string | null
}

/** Folgas, férias, feriados e bloqueios pontuais (BL-053/090/094). Usado tanto na
 * aba Contato (exceções gerais) quanto na aba Profissionais (exceções individuais). */
export function ScheduleExceptionsEditor({ professionalId }: ScheduleExceptionsEditorProps) {
  const { data: exceptions } = useScheduleExceptions(professionalId)
  const save = useSaveScheduleException(professionalId)
  const remove = useDeleteScheduleException(professionalId)
  const [draft, setDraft] = useState({ startsAt: '', endsAt: '', reason: '' })

  function handleAdd(event: FormEvent) {
    event.preventDefault()
    if (!draft.startsAt || !draft.endsAt) return

    save.mutate(
      {
        professional_id: professionalId,
        starts_at: new Date(draft.startsAt).toISOString(),
        ends_at: new Date(draft.endsAt).toISOString(),
        reason: draft.reason || null,
      },
      { onSuccess: () => setDraft({ startsAt: '', endsAt: '', reason: '' }) },
    )
  }

  return (
    <div className="max-w-xl space-y-4">
      <ul className="space-y-2">
        {exceptions?.map((exception) => (
          <li
            key={exception.id}
            className="flex items-center justify-between gap-4 rounded-card border border-border px-4 py-2.5"
          >
            <span className="min-w-0 text-small">
              {toDatetimeLocalValue(exception.starts_at).replace('T', ' ')} até{' '}
              {toDatetimeLocalValue(exception.ends_at).replace('T', ' ')}
              {exception.reason && ` · ${exception.reason}`}
            </span>
            <button
              type="button"
              aria-label="Remover"
              onClick={() => confirmDelete('esta exceção') && remove.mutate(exception.id)}
              className="shrink-0 text-muted transition-control hover:text-foreground"
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </button>
          </li>
        ))}
        {exceptions?.length === 0 && (
          <p className="text-small text-muted">Nenhuma exceção cadastrada.</p>
        )}
      </ul>

      <form onSubmit={handleAdd} className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Field label="Início" className="min-w-0 flex-1">
            <DateTimeInput
              required
              value={draft.startsAt}
              onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })}
            />
          </Field>
          <Field label="Fim" className="min-w-0 flex-1">
            <DateTimeInput
              required
              value={draft.endsAt}
              onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })}
            />
          </Field>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Motivo (opcional)" className="min-w-0 flex-1">
            <TextInput
              placeholder="Ex.: Férias"
              value={draft.reason}
              onChange={(event) => setDraft({ ...draft, reason: event.target.value })}
            />
          </Field>
          <Button type="submit" variant="outline" disabled={save.isPending}>
            Adicionar
          </Button>
        </div>
      </form>
    </div>
  )
}
