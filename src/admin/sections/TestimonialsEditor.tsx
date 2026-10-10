import { Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { Button } from '@/components/ui'
import {
  type TestimonialRow,
  useDeleteTestimonial,
  useSaveTestimonial,
  useTestimonials,
} from '@/queries/testimonials'

import { Field, Select, TextArea, TextInput } from '../components/Field'
import { confirmDelete } from '../components/confirmDelete'

const ratings = [5, 4, 3, 2, 1]

function TestimonialForm({
  testimonial,
  onSaved,
}: {
  testimonial?: TestimonialRow
  onSaved?: () => void
}) {
  const save = useSaveTestimonial()
  const [form, setForm] = useState({
    clientName: testimonial?.client_name ?? '',
    rating: testimonial?.rating ?? 5,
    quote: testimonial?.quote ?? '',
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    save.mutate(
      {
        id: testimonial?.id,
        client_name: form.clientName,
        rating: form.rating,
        quote: form.quote,
        sort_order: testimonial?.sort_order ?? 0,
      },
      {
        onSuccess: () => {
          if (!testimonial) setForm({ clientName: '', rating: 5, quote: '' })
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
        <Field label="Nome do cliente">
          <TextInput
            required
            value={form.clientName}
            onChange={(event) => setForm({ ...form, clientName: event.target.value })}
          />
        </Field>
        <Field label="Nota">
          <Select
            value={form.rating}
            onChange={(event) => setForm({ ...form, rating: Number(event.target.value) })}
          >
            {ratings.map((rating) => (
              <option key={rating} value={rating}>
                {rating} {rating === 1 ? 'estrela' : 'estrelas'}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Depoimento">
        <TextArea
          required
          value={form.quote}
          onChange={(event) => setForm({ ...form, quote: event.target.value })}
        />
      </Field>

      <Button type="submit" size="sm" disabled={save.isPending}>
        {testimonial ? 'Salvar' : 'Adicionar depoimento'}
      </Button>
    </form>
  )
}

/** BL-023: depoimentos reais de clientes — nome, nota e o texto, exibidos no carousel da landing. */
export function TestimonialsEditor() {
  const { data: testimonials } = useTestimonials()
  const remove = useDeleteTestimonial()
  const [adding, setAdding] = useState(false)

  return (
    <div className="max-w-xl space-y-6">
      <ul className="space-y-4">
        {testimonials?.map((testimonial) => (
          <li key={testimonial.id} className="relative">
            <TestimonialForm testimonial={testimonial} />
            <button
              type="button"
              aria-label={`Remover depoimento de ${testimonial.client_name}`}
              onClick={() => confirmDelete('este depoimento') && remove.mutate(testimonial.id)}
              className="absolute top-4 right-4 text-muted transition-control hover:text-foreground"
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </button>
          </li>
        ))}
      </ul>

      {testimonials?.length === 0 && !adding && (
        <p className="text-small text-muted">Nenhum depoimento cadastrado ainda.</p>
      )}

      {adding ? (
        <TestimonialForm onSaved={() => setAdding(false)} />
      ) : (
        <Button type="button" variant="outline" onClick={() => setAdding(true)}>
          Novo depoimento
        </Button>
      )}
    </div>
  )
}
