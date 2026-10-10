import {
  useDeleteProfessionalService,
  useProfessionalServices,
  useSaveProfessionalService,
} from '@/queries/professionals'
import { useServices } from '@/queries/services'
import { formatBRL } from '@/utils/currency'

import { TextInput } from '../../components/Field'

/** BL-091: quais serviços o profissional realiza, com preço/duração opcionais por profissional. */
export function ProfessionalServicesEditor({ professionalId }: { professionalId: string }) {
  const { data: services } = useServices()
  const { data: associations } = useProfessionalServices()
  const save = useSaveProfessionalService()
  const remove = useDeleteProfessionalService()

  const byService = new Map(
    associations
      ?.filter((row) => row.professional_id === professionalId)
      .map((row) => [row.service_id, row]),
  )

  function toggle(serviceId: string, enabled: boolean) {
    if (enabled) {
      save.mutate({
        professional_id: professionalId,
        service_id: serviceId,
        price: null,
        duration_minutes: null,
      })
    } else {
      remove.mutate({ professionalId, serviceId })
    }
  }

  function updateOverride(
    serviceId: string,
    patch: { price?: number | null; duration_minutes?: number | null },
  ) {
    const current = byService.get(serviceId)
    save.mutate({
      professional_id: professionalId,
      service_id: serviceId,
      price: current?.price ?? null,
      duration_minutes: current?.duration_minutes ?? null,
      ...patch,
    })
  }

  if (!services || services.length === 0) {
    return <p className="text-small text-muted">Cadastre serviços antes de associá-los.</p>
  }

  return (
    <ul className="space-y-2">
      {services.map((service) => {
        const association = byService.get(service.id)
        const enabled = association !== undefined

        return (
          <li key={service.id} className="rounded-card border border-border px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <label className="flex items-center gap-2 text-small">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => toggle(service.id, event.target.checked)}
                />
                {service.name}
              </label>
              <span className="text-caption text-muted">
                Padrão: {service.duration_minutes} min
                {service.price != null && ` · ${formatBRL(service.price)}`}
              </span>
            </div>

            {enabled && (
              <div className="mt-2 flex flex-wrap items-center gap-3 ps-6">
                <label className="flex items-center gap-2 text-caption text-muted">
                  <span className="whitespace-nowrap">Preço próprio (R$)</span>
                  <TextInput
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder={service.price?.toString() ?? 'padrão'}
                    value={association?.price?.toString() ?? ''}
                    onChange={(event) =>
                      updateOverride(service.id, {
                        price: event.target.value ? Number(event.target.value) : null,
                      })
                    }
                    className="w-28"
                  />
                </label>
                <label className="flex items-center gap-2 text-caption text-muted">
                  <span className="whitespace-nowrap">Duração própria (min)</span>
                  <TextInput
                    type="number"
                    min={1}
                    placeholder={String(service.duration_minutes)}
                    value={association?.duration_minutes?.toString() ?? ''}
                    onChange={(event) =>
                      updateOverride(service.id, {
                        duration_minutes: event.target.value ? Number(event.target.value) : null,
                      })
                    }
                    className="w-24"
                  />
                </label>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
