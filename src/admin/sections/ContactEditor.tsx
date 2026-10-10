import { Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { Button } from '@/components/ui'
import type { Database, SocialPlatform } from '@/lib/database.types'
import {
  useContactSettings,
  useDeleteSocialLink,
  useOpeningHours,
  useSaveOpeningHoursBulk,
  useSaveSocialLink,
  useSocialLinks,
  useUpdateContactSettings,
} from '@/queries/contact'
import { formatHoursRange, WEEKDAY_NAMES } from '@/utils/openingHours'
import { socialLabels } from '@/utils/social'

import { ScheduleExceptionsEditor } from '../components/ScheduleExceptionsEditor'
import { Field, Select, TextInput } from '../components/Field'
import { confirmDelete } from '../components/confirmDelete'

type ContactSettings = Database['public']['Tables']['contact_settings']['Row']

function ContactFieldsForm({ contact }: { contact: ContactSettings }) {
  const update = useUpdateContactSettings()

  const [form, setForm] = useState({
    whatsapp: contact.whatsapp ?? '',
    phone: contact.phone ?? '',
    email: contact.email ?? '',
    street: contact.street ?? '',
    neighborhood: contact.neighborhood ?? '',
    city: contact.city,
    state: contact.state,
    postalCode: contact.postal_code ?? '',
    country: contact.country,
    mapsUrl: contact.maps_url ?? '',
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    update.mutate({
      whatsapp: form.whatsapp || null,
      phone: form.phone || null,
      email: form.email || null,
      street: form.street || null,
      neighborhood: form.neighborhood || null,
      city: form.city,
      state: form.state,
      postal_code: form.postalCode || null,
      country: form.country,
      maps_url: form.mapsUrl || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Telefone" hint="Só dígitos: DDI + DDD + número.">
          <TextInput
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
        </Field>
        <Field label="WhatsApp" hint="Só dígitos. Deixe em branco se for o mesmo que o telefone.">
          <TextInput
            value={form.whatsapp}
            onChange={(event) => setForm({ ...form, whatsapp: event.target.value })}
          />
        </Field>
      </div>

      <Field label="Email">
        <TextInput
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Rua/número">
          <TextInput
            value={form.street}
            onChange={(event) => setForm({ ...form, street: event.target.value })}
          />
        </Field>
        <Field label="Bairro">
          <TextInput
            value={form.neighborhood}
            onChange={(event) => setForm({ ...form, neighborhood: event.target.value })}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Cidade">
          <TextInput
            required
            value={form.city}
            onChange={(event) => setForm({ ...form, city: event.target.value })}
          />
        </Field>
        <Field label="Estado (sigla)">
          <TextInput
            required
            maxLength={2}
            value={form.state}
            onChange={(event) => setForm({ ...form, state: event.target.value.toUpperCase() })}
          />
        </Field>
        <Field label="CEP">
          <TextInput
            value={form.postalCode}
            onChange={(event) => setForm({ ...form, postalCode: event.target.value })}
          />
        </Field>
      </div>

      <Field label="Link do Google Maps" hint="Usado no botão 'Como chegar'.">
        <TextInput
          type="url"
          value={form.mapsUrl}
          onChange={(event) => setForm({ ...form, mapsUrl: event.target.value })}
        />
      </Field>

      <Button type="submit" disabled={update.isPending}>
        {update.isPending ? 'Salvando…' : 'Salvar'}
      </Button>
      {update.isSuccess && <span className="ms-3 text-small text-muted">Salvo.</span>}
    </form>
  )
}

type OpeningHoursRow = Database['public']['Tables']['opening_hours']['Row']

interface DayDraft {
  id: string | null
  closed: boolean
  opensAt: string
  closesAt: string
}

function draftsFromRows(rows: OpeningHoursRow[] | undefined): DayDraft[] {
  const byWeekday = new Map(
    rows?.filter((row) => row.weekday !== null).map((row) => [row.weekday, row]),
  )

  return WEEKDAY_NAMES.map((_, weekday) => {
    const row = byWeekday.get(weekday)
    return {
      id: row?.id ?? null,
      closed: !row?.opens_at || !row?.closes_at,
      opensAt: row?.opens_at?.slice(0, 5) ?? '09:00',
      closesAt: row?.closes_at?.slice(0, 5) ?? '19:00',
    }
  })
}

/** BL-093: um editor por dia da semana (aberto/fechado + horário), em vez de texto livre. */
function OpeningHoursEditor() {
  const { data: hours } = useOpeningHours()
  const save = useSaveOpeningHoursBulk()
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
        weekday,
        opens_at: day.opensAt,
        closes_at: day.closesAt,
        days: WEEKDAY_NAMES[weekday],
        hours: formatHoursRange(day.opensAt, day.closesAt),
        sort_order: weekday,
      }))

    const deleteIds = days.filter((day) => day.closed && day.id).map((day) => day.id as string)

    // Reseta o rascunho após salvar: os ids gerados na hora (crypto.randomUUID) só
    // existem no servidor depois do upsert, então a próxima edição parte dos dados
    // recarregados (com os ids reais), em vez de gerar um novo id a cada envio.
    save.mutate({ upsert, deleteIds }, { onSuccess: () => setDrafts(null) })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-3">
      {days.map((day, weekday) => (
        <div key={weekday} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <label className="flex items-center gap-2 text-small sm:w-36 sm:shrink-0">
            <input
              type="checkbox"
              checked={!day.closed}
              onChange={(event) => updateDay(weekday, { closed: !event.target.checked })}
            />
            {WEEKDAY_NAMES[weekday]}
          </label>

          {day.closed ? (
            <span className="text-small text-muted">Fechado</span>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <TextInput
                type="time"
                value={day.opensAt}
                onChange={(event) => updateDay(weekday, { opensAt: event.target.value })}
                className="min-w-0 flex-1 sm:w-32 sm:flex-none"
              />
              <span className="shrink-0 text-small text-muted">às</span>
              <TextInput
                type="time"
                value={day.closesAt}
                onChange={(event) => updateDay(weekday, { closesAt: event.target.value })}
                className="min-w-0 flex-1 sm:w-32 sm:flex-none"
              />
            </div>
          )}
        </div>
      ))}

      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? 'Salvando…' : 'Salvar horários'}
      </Button>
      {save.isSuccess && <span className="ms-3 text-small text-muted">Salvo.</span>}
    </form>
  )
}

const socialPlatforms = Object.keys(socialLabels) as SocialPlatform[]

/** Exemplo de URL por rede, só para o placeholder do campo — nunca o valor do input. */
const socialUrlPlaceholder: Record<SocialPlatform, string> = {
  instagram: 'https://instagram.com/...',
  facebook: 'https://facebook.com/...',
  tiktok: 'https://tiktok.com/@...',
  youtube: 'https://youtube.com/@...',
}

function SocialLinksEditor() {
  const { data: socials } = useSocialLinks()
  const save = useSaveSocialLink()
  const remove = useDeleteSocialLink()
  const [draft, setDraft] = useState<{ platform: SocialPlatform; url: string }>({
    platform: 'instagram',
    url: '',
  })

  function handleAdd(event: FormEvent) {
    event.preventDefault()
    if (!draft.url) return
    save.mutate(
      { platform: draft.platform, url: draft.url, sort_order: socials?.length ?? 0 },
      { onSuccess: () => setDraft({ ...draft, url: '' }) },
    )
  }

  return (
    <div className="max-w-xl space-y-4">
      <ul className="space-y-2">
        {socials?.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-4 rounded-card border border-border px-4 py-2.5"
          >
            <span className="min-w-0 text-small break-all">
              {socialLabels[item.platform]} — {item.url}
            </span>
            <button
              type="button"
              aria-label="Remover"
              onClick={() => confirmDelete('este link') && remove.mutate(item.id)}
              className="shrink-0 text-muted transition-control hover:text-foreground"
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </button>
          </li>
        ))}
        {socials?.length === 0 && <p className="text-small text-muted">Nenhuma rede cadastrada.</p>}
      </ul>

      <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Rede" className="sm:w-auto">
          <Select
            value={draft.platform}
            onChange={(event) =>
              setDraft({ ...draft, platform: event.target.value as SocialPlatform })
            }
            className="sm:w-auto"
          >
            {socialPlatforms.map((platform) => (
              <option key={platform} value={platform}>
                {socialLabels[platform]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="URL" className="min-w-0 flex-1">
          <TextInput
            type="url"
            required
            placeholder={socialUrlPlaceholder[draft.platform]}
            value={draft.url}
            onChange={(event) => setDraft({ ...draft, url: event.target.value })}
            className="min-w-0"
          />
        </Field>
        <Button type="submit" variant="outline" disabled={save.isPending}>
          Adicionar
        </Button>
      </form>
    </div>
  )
}

export function ContactEditor() {
  const { data: contact } = useContactSettings()

  return (
    <div className="space-y-12">
      <section>
        <h2 className="font-display text-title-4">Dados de contato</h2>
        <div className="mt-5">{contact && <ContactFieldsForm contact={contact} />}</div>
      </section>

      <section>
        <h2 className="font-display text-title-4">Horário de funcionamento</h2>
        <div className="mt-5">
          <OpeningHoursEditor />
        </div>
      </section>

      <section>
        <h2 className="font-display text-title-4">Feriados e fechamentos</h2>
        <p className="mt-1 text-small text-muted">
          Datas em que a barbearia inteira fica fechada, além do horário semanal acima.
        </p>
        <div className="mt-5">
          <ScheduleExceptionsEditor professionalId={null} />
        </div>
      </section>

      <section>
        <h2 className="font-display text-title-4">Redes sociais</h2>
        <div className="mt-5">
          <SocialLinksEditor />
        </div>
      </section>
    </div>
  )
}
