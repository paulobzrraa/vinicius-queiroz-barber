import { type FormEvent, useState } from 'react'

import { Button } from '@/components/ui'
import { useProfessionals, useSaveProfessional } from '@/queries/professionals'

import { Field, TextInput } from '../../components/Field'
import { ProfessionalCard } from './ProfessionalCard'

function NewProfessionalForm({ existingCount }: { existingCount: number }) {
  const save = useSaveProfessional()
  const [name, setName] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    save.mutate(
      { name: name.trim(), sort_order: existingCount, active: true },
      { onSuccess: () => setName('') },
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-card border border-dashed border-border p-card"
    >
      <Field label="Nome do novo profissional" className="flex-1">
        <TextInput
          required
          placeholder="Ex.: João Silva"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <Button type="submit" variant="outline" disabled={save.isPending}>
        Adicionar profissional
      </Button>
    </form>
  )
}

/** BL-088: cadastro dos profissionais que atendem na barbearia. */
export function ProfessionalsEditor() {
  const { data: professionals } = useProfessionals()

  return (
    <div className="max-w-2xl space-y-6">
      <ul className="space-y-6">
        {professionals?.map((professional) => (
          <ProfessionalCard key={professional.id} professional={professional} />
        ))}
      </ul>

      {professionals?.length === 0 && (
        <p className="text-small text-muted">Nenhum profissional cadastrado ainda.</p>
      )}

      <NewProfessionalForm existingCount={professionals?.length ?? 0} />
    </div>
  )
}
