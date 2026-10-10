import { type FormEvent, useState } from 'react'

import { Button } from '@/components/ui'
import { useProfessionalHours, useSaveProfessionalHoursBulk } from '@/queries/professionals'
import { WEEKDAY_NAMES } from '@/utils/openingHours'

import { TextInput } from '../../components/Field'

interface DayDraft {
  id: string | null
  closed: boolean
  opensAt: string
  closesAt: string
  hasBreak: boolean
  breakStartsAt: string
  breakEndsAt: string
}

function draftsFromRows(rows: ReturnType<typeof useProfessionalHours>['data']): DayDraft[] {
  const byWeekday = new Map(rows?.map((row) => [row.weekday, row]))

  return WEEKDAY_NAMES.map((_, weekday) => {
    const row = byWeekday.get(weekday)
    return {
      id: row?.id ?? null,
      closed: !row,
      opensAt: row?.starts_at.slice(0, 5) ?? '09:00',
      closesAt: row?.ends_at.slice(0, 5) ?? '19:00',
      hasBreak: Boolean(row?.break_starts_at),
      breakStartsAt: row?.break_starts_at?.slice(0, 5) ?? '12:00',
      breakEndsAt: row?.break_ends_at?.slice(0, 5) ?? '13:00',
    }
  })
}

/** BL-089: expediente semanal do profissional, com intervalo de almoço opcional por dia. */
export function ProfessionalHoursEditor({ professionalId }: { professionalId: string }) {
  const { data: hours } = useProfessionalHours(professionalId)
  const save = useSaveProfessionalHoursBulk(professionalId)
  const [drafts, setDrafts] = useState<DayDraft[] | null>(null)

  const days = drafts ?? draftsFromRows(hours)

  function updateDay(weekday: number, patch: Partial<DayDraft>) {
    setDrafts(days.map((day, index) => (index === weekday ? { ...day, ...patch } : day)))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const upsert = days
      .filter((day) => !day.closed)
      .map((day, weekday) => ({
        id: day.id ?? crypto.randomUUID(),
        professional_id: professionalId,
        weekday,
        starts_at: day.opensAt,
        ends_at: day.closesAt,
        break_starts_at: day.hasBreak ? day.breakStartsAt : null,
        break_ends_at: day.hasBreak ? day.breakEndsAt : null,
      }))

    const deleteIds = days.filter((day) => day.closed && day.id).map((day) => day.id as string)

    save.mutate({ upsert, deleteIds }, { onSuccess: () => setDrafts(null) })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {days.map((day, weekday) => (
        <div key={weekday} className="flex flex-wrap items-center gap-3">
          <label className="flex w-32 shrink-0 items-center gap-2 text-small">
            <input
              type="checkbox"
              checked={!day.closed}
              onChange={(event) => updateDay(weekday, { closed: !event.target.checked })}
            />
            {WEEKDAY_NAMES[weekday]}
          </label>

          {day.closed ? (
            <span className="text-small text-muted">Não atende</span>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <TextInput
                type="time"
                value={day.opensAt}
                onChange={(event) => updateDay(weekday, { opensAt: event.target.value })}
                className="w-28"
              />
              <span className="text-small text-muted">às</span>
              <TextInput
                type="time"
                value={day.closesAt}
                onChange={(event) => updateDay(weekday, { closesAt: event.target.value })}
                className="w-28"
              />

              <label className="ms-2 flex items-center gap-2 text-caption text-muted">
                <input
                  type="checkbox"
                  checked={day.hasBreak}
                  onChange={(event) => updateDay(weekday, { hasBreak: event.target.checked })}
                />
                Almoço
              </label>
              {day.hasBreak && (
                <>
                  <TextInput
                    type="time"
                    value={day.breakStartsAt}
                    onChange={(event) => updateDay(weekday, { breakStartsAt: event.target.value })}
                    className="w-28"
                  />
                  <span className="text-small text-muted">às</span>
                  <TextInput
                    type="time"
                    value={day.breakEndsAt}
                    onChange={(event) => updateDay(weekday, { breakEndsAt: event.target.value })}
                    className="w-28"
                  />
                </>
              )}
            </div>
          )}
        </div>
      ))}

      <Button type="submit" size="sm" disabled={save.isPending}>
        {save.isPending ? 'Salvando…' : 'Salvar horários'}
      </Button>
      {save.isError && (
        <span className="ms-3 text-small text-muted">
          Não foi possível salvar — confira se o almoço cabe dentro do expediente.
        </span>
      )}
      {save.isSuccess && <span className="ms-3 text-small text-muted">Salvo.</span>}
    </form>
  )
}
