import { Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { Button } from '@/components/ui'
import { type ServiceRow, useDeleteService, useSaveService, useServices } from '@/queries/services'
import { slugify } from '@/utils/slugify'

import { Field, TextArea, TextInput } from '../components/Field'
import { confirmDelete } from '../components/confirmDelete'

function ServiceForm({ service, onSaved }: { service?: ServiceRow; onSaved?: () => void }) {
  const save = useSaveService()
  const [form, setForm] = useState({
    name: service?.name ?? '',
    description: service?.description ?? '',
    price: service?.price?.toString() ?? '',
    durationMinutes: service?.duration_minutes.toString() ?? '',
    active: service?.active ?? true,
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const id = service?.id ?? slugify(form.name)
    const duration = Number(form.durationMinutes)
    if (!id || !duration) return

    save.mutate(
      {
        id,
        name: form.name,
        description: form.description,
        price: form.price ? Number(form.price) : null,
        duration_minutes: duration,
        sort_order: service?.sort_order ?? 0,
        active: form.active,
      },
      {
        onSuccess: () => {
          if (!service) {
            setForm({ name: '', description: '', price: '', durationMinutes: '', active: true })
          }
          onSaved?.()
        },
      },
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-card border border-border bg-surface p-card"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome">
          <TextInput
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </Field>
        <Field
          label="Preço (R$)"
          hint="Deixe em branco para não mostrar. Usado também para somar o total do cliente e os relatórios financeiros."
        >
          <TextInput
            type="number"
            min={0}
            step={0.01}
            value={form.price}
            onChange={(event) => setForm({ ...form, price: event.target.value })}
          />
        </Field>
      </div>

      <Field label="Descrição">
        <TextArea
          required
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
        />
      </Field>

      <div className="flex flex-wrap items-end gap-4">
        <Field label="Duração (minutos)" hint="Usada para calcular os horários de agendamento.">
          <TextInput
            required
            type="number"
            min={1}
            className="max-w-32"
            value={form.durationMinutes}
            onChange={(event) => setForm({ ...form, durationMinutes: event.target.value })}
          />
        </Field>

        <label className="mb-2.5 flex items-center gap-2 text-small text-muted">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(event) => setForm({ ...form, active: event.target.checked })}
          />
          Visível para o cliente
        </label>
      </div>

      <Button type="submit" size="sm" disabled={save.isPending}>
        {service ? 'Salvar' : 'Adicionar serviço'}
      </Button>
    </form>
  )
}

export function ServicesEditor() {
  const { data: services } = useServices()
  const remove = useDeleteService()
  const [adding, setAdding] = useState(false)

  return (
    <div className="max-w-xl space-y-6">
      {adding ? (
        <ServiceForm onSaved={() => setAdding(false)} />
      ) : (
        <Button type="button" variant="outline" onClick={() => setAdding(true)}>
          Novo serviço
        </Button>
      )}
      <ul className="space-y-4">
        {services?.map((service) => (
          <li key={service.id} className="relative">
            <ServiceForm service={service} />
            {!service.active && (
              <span className="absolute top-4 right-14 text-caption text-muted uppercase">
                Pausado
              </span>
            )}
            <button
              type="button"
              aria-label={`Remover ${service.name}`}
              onClick={() =>
                confirmDelete(`o serviço ${service.name}`) && remove.mutate(service.id)
              }
              className="absolute top-4 right-4 text-muted transition-control hover:text-foreground"
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </button>
          </li>
        ))}
      </ul>

      {services?.length === 0 && !adding && (
        <p className="text-small text-muted">Nenhum serviço cadastrado ainda.</p>
      )}
    </div>
  )
}
