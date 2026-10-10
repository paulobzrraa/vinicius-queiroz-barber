import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button, IconButton, Text } from '@/components/ui'
import { useRevenueInRange } from '@/queries/finance'
import { useProfessionals, useSaveProfessional } from '@/queries/professionals'
import { formatBRL } from '@/utils/currency'

import { TextInput } from '../../components/Field'
import { defaultPeriodKey, periodLabel, periodRangeIso, shiftPeriodKey } from './periodUtils'

/** BL-098: percentual de comissão por profissional e o valor calculado sobre o ganho do período. */
export function CommissionsEditor() {
  const [key, setKey] = useState(() => defaultPeriodKey('month'))
  const { startIso, endIso } = periodRangeIso('month', key)

  const { data: professionals } = useProfessionals()
  const { data: revenue, isLoading } = useRevenueInRange(startIso, endIso)
  const save = useSaveProfessional()

  const revenueByProfessional = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of revenue ?? [])
      map.set(row.professionalId, (map.get(row.professionalId) ?? 0) + row.total)
    return map
  }, [revenue])

  const totalCommission = (professionals ?? []).reduce((sum, professional) => {
    const revenueTotal = revenueByProfessional.get(professional.id) ?? 0
    const percent = professional.commission_percent ?? 0
    return sum + (revenueTotal * percent) / 100
  }, 0)

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <IconButton
            aria-label="Mês anterior"
            onClick={() => setKey(shiftPeriodKey('month', key, -1))}
          >
            <ChevronLeft />
          </IconButton>
          <Text size="body" className="font-semibold capitalize">
            {periodLabel('month', key)}
          </Text>
          <IconButton
            aria-label="Próximo mês"
            onClick={() => setKey(shiftPeriodKey('month', key, 1))}
          >
            <ChevronRight />
          </IconButton>
        </div>
        {key !== defaultPeriodKey('month') && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setKey(defaultPeriodKey('month'))}
          >
            Este mês
          </Button>
        )}
      </div>

      {isLoading && (
        <Text size="small" tone="muted">
          Carregando…
        </Text>
      )}

      {professionals?.length === 0 && (
        <Text size="small" tone="muted">
          Nenhum profissional cadastrado ainda.
        </Text>
      )}

      <ul className="space-y-3">
        {professionals?.map((professional) => {
          const revenueTotal = revenueByProfessional.get(professional.id) ?? 0
          const percent = professional.commission_percent
          const commission = percent ? (revenueTotal * percent) / 100 : 0

          return (
            <li
              key={professional.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border px-4 py-3"
            >
              <div>
                <p className="text-small font-semibold text-foreground">{professional.name}</p>
                <p className="mt-0.5 text-caption text-muted">
                  Ganho no período: {formatBRL(revenueTotal)}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-small text-muted">
                  <TextInput
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={percent?.toString() ?? ''}
                    placeholder="0"
                    onChange={(event) =>
                      save.mutate({
                        ...professional,
                        commission_percent: event.target.value ? Number(event.target.value) : null,
                      })
                    }
                    className="w-20"
                  />
                  %
                </label>
                <span className="w-28 text-end text-small font-semibold whitespace-nowrap">
                  {formatBRL(commission)}
                </span>
              </div>
            </li>
          )
        })}
      </ul>

      {(professionals?.length ?? 0) > 0 && (
        <div className="flex items-baseline justify-between gap-4 border-t border-border pt-4">
          <Text size="small" className="font-semibold">
            Total de comissões
          </Text>
          <Text size="small" className="font-semibold">
            {formatBRL(totalCommission)}
          </Text>
        </div>
      )}
    </div>
  )
}
