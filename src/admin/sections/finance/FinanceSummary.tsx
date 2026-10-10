import { ChevronLeft, ChevronRight, Download, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button, IconButton, Text } from '@/components/ui'
import { PAYMENT_METHOD_LABELS, useExpensesInRange, useRevenueInRange } from '@/queries/finance'
import { useProfessionals } from '@/queries/professionals'
import { cn } from '@/utils/cn'
import { formatBRL } from '@/utils/currency'

import { dateKeyOf } from '../agenda/dateUtils'
import {
  daysInPeriod,
  defaultPeriodKey,
  periodLabel,
  periodModeLabels,
  periodRangeDateKeys,
  periodRangeIso,
  shiftPeriodKey,
  type PeriodMode,
} from './periodUtils'

function sumBy<T>(items: T[], value: (item: T) => number): number {
  return items.reduce((sum, item) => sum + value(item), 0)
}

/** null quando não há base de comparação (período anterior zerado) — a barra de delta some em vez de mostrar "∞%". */
function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null
  const positive = delta >= 0
  return (
    <p
      className={cn(
        'mt-2 flex items-center justify-center gap-1.5 text-caption whitespace-nowrap',
        positive ? 'text-foreground' : 'text-muted',
      )}
    >
      {positive ? (
        <TrendingUp aria-hidden="true" className="size-3.5 shrink-0" />
      ) : (
        <TrendingDown aria-hidden="true" className="size-3.5 shrink-0" />
      )}
      <span>
        <span className="font-semibold">{Math.abs(delta).toFixed(0)}%</span> vs. período anterior
      </span>
    </p>
  )
}

function StatTile({
  label,
  value,
  delta,
}: {
  label: string
  value: string
  delta?: number | null
}) {
  return (
    <div className="rounded-card border border-border bg-surface p-5 text-center">
      <Text size="caption" tone="muted" className="uppercase">
        {label}
      </Text>
      <p className="mt-1 font-display text-title-4">{value}</p>
      {delta !== undefined && <DeltaBadge delta={delta} />}
    </div>
  )
}

function BreakdownList({ title, entries }: { title: string; entries: [string, number][] }) {
  if (entries.length === 0) return null
  const sorted = [...entries].sort((a, b) => b[1] - a[1])

  return (
    <div>
      <Text size="caption" tone="muted" className="uppercase">
        {title}
      </Text>
      <ul className="mt-3 space-y-3">
        {sorted.map(([label, total]) => (
          <li
            key={label}
            className="flex flex-col gap-0.5 text-small sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
          >
            <span className="text-pretty text-muted">{label}</span>
            <span className="font-semibold whitespace-nowrap">{formatBRL(total)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(';'))
    .join('\n')
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

/** BL-098: visão geral do módulo financeiro — ganho, despesas, comissões e lucro de um período. */
export function FinanceSummary() {
  const [mode, setMode] = useState<PeriodMode>('day')
  const [key, setKey] = useState(() => defaultPeriodKey('day'))

  function changeMode(nextMode: PeriodMode) {
    setMode(nextMode)
    setKey(defaultPeriodKey(nextMode))
  }

  const { startIso, endIso } = periodRangeIso(mode, key)
  const { startDate, endDate } = periodRangeDateKeys(mode, key)
  const prevKey = shiftPeriodKey(mode, key, -1)
  const prevIso = periodRangeIso(mode, prevKey)
  const prevDate = periodRangeDateKeys(mode, prevKey)

  const { data: revenue, isLoading: loadingRevenue } = useRevenueInRange(startIso, endIso)
  const { data: expenses, isLoading: loadingExpenses } = useExpensesInRange(startDate, endDate)
  const { data: prevRevenue } = useRevenueInRange(prevIso.startIso, prevIso.endIso)
  const { data: prevExpenses } = useExpensesInRange(prevDate.startDate, prevDate.endDate)
  const { data: professionals } = useProfessionals()

  const commissionByProfessional = useMemo(() => {
    const percentById = new Map(
      professionals?.map((professional) => [professional.id, professional.commission_percent]),
    )
    return (rows: typeof revenue) => {
      const byProfessional = new Map<string, number>()
      for (const row of rows ?? []) {
        byProfessional.set(
          row.professionalId,
          (byProfessional.get(row.professionalId) ?? 0) + row.total,
        )
      }
      let total = 0
      for (const [professionalId, revenueTotal] of byProfessional) {
        const percent = percentById.get(professionalId)
        if (percent) total += (revenueTotal * percent) / 100
      }
      return total
    }
  }, [professionals])

  const totalRevenue = sumBy(revenue ?? [], (row) => row.total)
  const totalExpenses = sumBy(expenses ?? [], (row) => row.amount)
  const totalCommission = commissionByProfessional(revenue)
  const netProfit = totalRevenue - totalExpenses - totalCommission

  const prevTotalRevenue = sumBy(prevRevenue ?? [], (row) => row.total)
  const prevTotalExpenses = sumBy(prevExpenses ?? [], (row) => row.amount)
  const prevTotalCommission = commissionByProfessional(prevRevenue)
  const prevNetProfit = prevTotalRevenue - prevTotalExpenses - prevTotalCommission

  const byProfessional = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of revenue ?? [])
      map.set(row.professionalName, (map.get(row.professionalName) ?? 0) + row.total)
    return [...map.entries()]
  }, [revenue])

  const byService = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of revenue ?? [])
      for (const service of row.services)
        map.set(service.serviceName, (map.get(service.serviceName) ?? 0) + service.price)
    return [...map.entries()]
  }, [revenue])

  const byPaymentMethod = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of revenue ?? []) {
      const label = row.paymentMethod ? PAYMENT_METHOD_LABELS[row.paymentMethod] : 'Sem registro'
      map.set(label, (map.get(label) ?? 0) + row.total)
    }
    return [...map.entries()]
  }, [revenue])

  // Semana: uma barra por dia. Mês: uma barra por bloco de 7 dias (31 barras não cabem no mobile).
  const chartBars = useMemo(() => {
    if (mode === 'day') return []
    const totalByDay = new Map<string, number>()
    for (const row of revenue ?? []) {
      const day = dateKeyOf(row.startsAt)
      totalByDay.set(day, (totalByDay.get(day) ?? 0) + row.total)
    }
    const days = daysInPeriod(mode, key)
    const short = (day: string) => `${day.slice(8)}/${day.slice(5, 7)}`
    const chunkSize = mode === 'month' ? 7 : 1
    const bars: { id: string; label: string; range: string; total: number }[] = []
    for (let i = 0; i < days.length; i += chunkSize) {
      const chunk = days.slice(i, i + chunkSize)
      const first = chunk[0]
      const last = chunk[chunk.length - 1]
      bars.push({
        id: first,
        label: chunkSize === 1 ? String(Number(first.slice(8))) : `Sem ${bars.length + 1}`,
        range: first === last ? short(first) : `${short(first)} – ${short(last)}`,
        total: chunk.reduce((sum, day) => sum + (totalByDay.get(day) ?? 0), 0),
      })
    }
    return bars
  }, [mode, key, revenue])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const activeId = hoverId ?? selectedId
  const activeBar = chartBars.find((bar) => bar.id === activeId) ?? null
  const maxDay = Math.max(1, ...chartBars.map((bar) => bar.total))

  function handleExport() {
    const rows: string[][] = [
      ['Data', 'Profissional', 'Serviços', 'Forma de pagamento', 'Valor'],
      ...(revenue ?? []).map((row) => [
        new Date(row.startsAt).toLocaleString('pt-BR'),
        row.professionalName,
        row.services.map((s) => s.serviceName).join(', '),
        row.paymentMethod ? PAYMENT_METHOD_LABELS[row.paymentMethod] : '',
        row.total.toFixed(2).replace('.', ','),
      ]),
      [],
      ['Resumo', '', '', '', ''],
      ['Ganho total', '', '', '', totalRevenue.toFixed(2).replace('.', ',')],
      ['Despesas', '', '', '', totalExpenses.toFixed(2).replace('.', ',')],
      ['Comissões', '', '', '', totalCommission.toFixed(2).replace('.', ',')],
      ['Lucro líquido', '', '', '', netProfit.toFixed(2).replace('.', ',')],
    ]
    downloadCsv(`financeiro-${key}.csv`, rows)
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex gap-2">
        {(['day', 'week', 'month'] as const).map((modeOption) => (
          <button
            key={modeOption}
            type="button"
            onClick={() => changeMode(modeOption)}
            className={cn(
              'rounded-control px-3 py-1.5 text-small transition-control',
              mode === modeOption
                ? 'bg-foreground/10 text-foreground'
                : 'text-muted hover:text-foreground',
            )}
          >
            {periodModeLabels[modeOption]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <IconButton
            aria-label="Período anterior"
            onClick={() => setKey(shiftPeriodKey(mode, key, -1))}
          >
            <ChevronLeft />
          </IconButton>
          <Text size="body" className="font-semibold capitalize">
            {periodLabel(mode, key)}
          </Text>
          <IconButton
            aria-label="Próximo período"
            onClick={() => setKey(shiftPeriodKey(mode, key, 1))}
          >
            <ChevronRight />
          </IconButton>
        </div>

        <div className="flex items-center gap-2">
          {key !== defaultPeriodKey(mode) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setKey(defaultPeriodKey(mode))}
            >
              Hoje
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            iconStart={<Download />}
            onClick={handleExport}
            disabled={(revenue ?? []).length === 0}
          >
            Exportar CSV
          </Button>
        </div>
      </div>

      {(loadingRevenue || loadingExpenses) && (
        <Text size="small" tone="muted">
          Carregando…
        </Text>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-3">
        <StatTile
          label="Ganho"
          value={formatBRL(totalRevenue)}
          delta={pctDelta(totalRevenue, prevTotalRevenue)}
        />
        <StatTile
          label="Despesas"
          value={formatBRL(totalExpenses)}
          delta={pctDelta(totalExpenses, prevTotalExpenses)}
        />
        <StatTile
          label="Comissões"
          value={formatBRL(totalCommission)}
          delta={pctDelta(totalCommission, prevTotalCommission)}
        />
        <StatTile
          label="Lucro líquido"
          value={formatBRL(netProfit)}
          delta={pctDelta(netProfit, prevNetProfit)}
        />
      </div>

      {chartBars.length > 0 && (
        <div className="rounded-card border border-border bg-surface p-5 sm:p-card">
          <Text size="caption" tone="muted" className="uppercase">
            {mode === 'month' ? 'Ganho por semana' : 'Ganho por dia'}
          </Text>

          {/* Leitura fixa acima das barras: funciona com toque (mobile) e com o mouse (hover), sem tooltip que corta na borda. */}
          <p className="mt-2 min-h-6 text-small" aria-live="polite">
            {activeBar ? (
              <>
                <span className="text-muted">{activeBar.range}</span>{' '}
                <span className="font-semibold">{formatBRL(activeBar.total)}</span>
              </>
            ) : (
              <span className="text-muted">Toque numa barra para ver o valor</span>
            )}
          </p>

          <div className="mt-4 flex h-36 gap-1" onMouseLeave={() => setHoverId(null)}>
            {chartBars.map(({ id, label, range, total }) => {
              const active = activeBar?.id === id
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={selectedId === id}
                  aria-label={`${range}: ${formatBRL(total)}`}
                  onMouseEnter={() => setHoverId(id)}
                  onClick={() => setSelectedId((current) => (current === id ? null : id))}
                  className="flex h-full min-w-0 flex-1 flex-col items-center gap-1.5 rounded-sm"
                >
                  {/* Altura em % só funciona num pai com altura definida: o flex-1 dá essa altura à trilha. */}
                  <div className="flex min-h-0 w-full flex-1 items-end">
                    <div
                      className={cn(
                        'w-full rounded-t-sm transition-control',
                        total > 0
                          ? active
                            ? 'bg-foreground'
                            : 'bg-foreground/70'
                          : active
                            ? 'bg-foreground/30'
                            : 'bg-foreground/15',
                      )}
                      style={{ height: `${total > 0 ? Math.max(4, (total / maxDay) * 100) : 3}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      'text-[0.625rem] leading-none tabular-nums',
                      active ? 'text-foreground' : 'text-muted',
                    )}
                  >
                    {label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {(revenue ?? []).length === 0 && !loadingRevenue && (
        <Text size="small" tone="muted">
          Nenhum agendamento concluído nesse período.
        </Text>
      )}

      <div className="grid max-w-2xl grid-cols-1 gap-y-10">
        <BreakdownList title="Por profissional" entries={byProfessional} />
        <BreakdownList title="Por serviço" entries={byService} />
        <BreakdownList title="Por forma de pagamento" entries={byPaymentMethod} />
      </div>
    </div>
  )
}
