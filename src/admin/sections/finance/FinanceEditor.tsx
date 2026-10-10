import { useState } from 'react'

import { cn } from '@/utils/cn'

import { CommissionsEditor } from './CommissionsEditor'
import { ExpensesEditor } from './ExpensesEditor'
import { FinanceSummary } from './FinanceSummary'

type Tab = 'summary' | 'expenses' | 'commissions'

const tabLabels: Record<Tab, string> = {
  summary: 'Resumo',
  expenses: 'Despesas',
  commissions: 'Comissões',
}

/** BL-098: módulo financeiro — ganho (Resumo), despesas e comissões por profissional. */
export function FinanceEditor() {
  const [tab, setTab] = useState<Tab>('summary')

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {(['summary', 'expenses', 'commissions'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setTab(option)}
            className={cn(
              'rounded-control px-3 py-1.5 text-small transition-control',
              tab === option
                ? 'bg-foreground/10 text-foreground'
                : 'text-muted hover:text-foreground',
            )}
          >
            {tabLabels[option]}
          </button>
        ))}
      </div>

      {tab === 'summary' && <FinanceSummary />}
      {tab === 'expenses' && <ExpensesEditor />}
      {tab === 'commissions' && <CommissionsEditor />}
    </div>
  )
}
