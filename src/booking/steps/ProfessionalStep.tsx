import { useEffect, useMemo } from 'react'

import { Button, Text } from '@/components/ui'
import { useActiveProfessionals, useProfessionalServices } from '@/queries/professionals'
import { OptionButton } from '../components/OptionButton'
import { StepShell } from '../components/StepShell'

interface ProfessionalStepProps {
  serviceIds: string[]
  professionalId: string | null
  onChange: (professionalId: string) => void
  onNext: () => void
}

/**
 * Nome do profissional que vem marcado por padrão, quando ele atende os serviços escolhidos.
 * null = sem pré-seleção por nome (o primeiro qualificado é marcado). Preencha ao configurar a barbearia.
 */
const DEFAULT_PROFESSIONAL_NAME: string | null = null

/** BL-067: escolha do profissional — só os cadastrados que atendem os serviços escolhidos
 * (BL-051), com o titular (BL-061) marcado por padrão. */
export function ProfessionalStep({
  serviceIds,
  professionalId,
  onChange,
  onNext,
}: ProfessionalStepProps) {
  const { data: professionals, isLoading: loadingProfessionals } = useActiveProfessionals()
  const { data: professionalServices, isLoading: loadingServices } = useProfessionalServices()

  const isLoading = loadingProfessionals || loadingServices

  // Só entram na lista os profissionais que fazem TODOS os serviços escolhidos (BL-051).
  const qualified = useMemo(
    () =>
      professionals?.filter((professional) =>
        serviceIds.every((serviceId) =>
          professionalServices?.some(
            (row) => row.professional_id === professional.id && row.service_id === serviceId,
          ),
        ),
      ),
    [professionals, professionalServices, serviceIds],
  )

  useEffect(() => {
    if (professionalId !== null || !qualified || qualified.length === 0) return

    const byDefaultName = DEFAULT_PROFESSIONAL_NAME
      ? qualified.find(
          (professional) =>
            professional.name.trim().toLowerCase() === DEFAULT_PROFESSIONAL_NAME.toLowerCase(),
        )
      : undefined
    onChange((byDefaultName ?? qualified[0]).id)
  }, [qualified, professionalId, onChange])

  return (
    <StepShell
      title="Com quem?"
      footer={
        <Button onClick={onNext} disabled={professionalId === null}>
          Continuar
        </Button>
      }
    >
      <div aria-live="polite">
        {isLoading && (
          <Text size="small" tone="muted">
            Carregando profissionais…
          </Text>
        )}
        {!isLoading && qualified?.length === 0 && (
          <Text size="small" tone="muted">
            Nenhum profissional faz essa combinação de serviços.
          </Text>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {qualified?.map((professional) => (
          <OptionButton
            key={professional.id}
            selected={professionalId === professional.id}
            title={professional.name}
            avatarUrl={professional.photo_url}
            onClick={() => onChange(professional.id)}
          />
        ))}
      </div>
    </StepShell>
  )
}
