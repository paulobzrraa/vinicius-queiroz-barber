import { Button, Text } from '@/components/ui'
import { useActiveServices } from '@/queries/services'
import { formatBRL } from '@/utils/currency'
import { OptionButton } from '../components/OptionButton'
import { StepShell } from '../components/StepShell'

interface ServiceStepProps {
  serviceIds: string[]
  onChange: (serviceIds: string[]) => void
  onNext: () => void
}

function serviceSubtitle(service: {
  price: number | null
  duration_minutes: number
}): string | undefined {
  const parts = [
    service.duration_minutes && `${service.duration_minutes} min`,
    service.price != null && formatBRL(service.price),
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : undefined
}

/** BL-065: escolha do serviço. BL-066: mais de um pode ser marcado ao mesmo tempo. */
export function ServiceStep({ serviceIds, onChange, onNext }: ServiceStepProps) {
  const { data: services, isLoading } = useActiveServices()

  function toggle(id: string) {
    onChange(serviceIds.includes(id) ? serviceIds.filter((s) => s !== id) : [...serviceIds, id])
  }

  return (
    <StepShell
      title="Qual serviço?"
      description="Pode escolher mais de um."
      footer={
        <Button disabled={serviceIds.length === 0} onClick={onNext}>
          Continuar
        </Button>
      }
    >
      <div aria-live="polite">
        {isLoading && (
          <Text size="small" tone="muted">
            Carregando serviços…
          </Text>
        )}

        {services?.length === 0 && (
          <Text size="small" tone="muted">
            Nenhum serviço disponível.
          </Text>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {services?.map((service) => (
          <OptionButton
            key={service.id}
            variant="checkbox"
            selected={serviceIds.includes(service.id)}
            title={service.name}
            subtitle={serviceSubtitle(service)}
            onClick={() => toggle(service.id)}
          />
        ))}
      </div>
    </StepShell>
  )
}
