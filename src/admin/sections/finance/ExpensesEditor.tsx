import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'

import { Button, IconButton, Text } from '@/components/ui'
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  type ExpenseRow,
  useDeleteExpense,
  useExpensesInRange,
  useSaveExpense,
} from '@/queries/finance'
import { formatBRL } from '@/utils/currency'

import { Field, Select, TextInput } from '../../components/Field'
import { todayKey } from '../agenda/dateUtils'
import { defaultPeriodKey, periodLabel, periodRangeDateKeys, shiftPeriodKey } from './periodUtils'
import { confirmDelete } from '../../components/confirmDelete'

function ExpenseForm({ expense, onSaved }: { expense?: ExpenseRow; onSaved?: () => void }) {
  const save = useSaveExpense()
  const [form, setForm] = useState({
    description: expense?.description ?? '',
    amount: expense?.amount.toString() ?? '',
    category: expense?.category ?? 'other',
    expenseDate: expense?.expense_date ?? todayKey(),
    recurring: expense?.recurring ?? false,
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const amount = Number(form.amount)
    if (!form.description || !amount) return

    const payload = {
      description: form.description,
      amount,
      category: form.category,
      expense_date: form.expenseDate,
      recurring: form.recurring,
    }

    save.mutate(expense ? { ...payload, id: expense.id } : payload, {
      onSuccess: () => {
        if (!expense) {
          setForm({
            description: '',
            amount: '',
            category: 'other',
            expenseDate: todayKey(),
            recurring: false,
          })
        }
        onSaved?.()
      },
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-card border border-border bg-surface p-card"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Descrição" className="sm:col-span-2">
          <TextInput
            required
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </Field>
        <Field label="Valor (R$)">
          <TextInput
            required
            type="number"
            min={0.01}
            step={0.01}
            value={form.amount}
            onChange={(event) => setForm({ ...form, amount: event.target.value })}
          />
        </Field>
        <Field label="Categoria">
          <Select
            value={form.category}
            onChange={(event) =>
              setForm({ ...form, category: event.target.value as ExpenseRow['category'] })
            }
          >
            {EXPENSE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {EXPENSE_CATEGORY_LABELS[category]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Data">
          <TextInput
            required
            type="date"
            value={form.expenseDate}
            onChange={(event) => setForm({ ...form, expenseDate: event.target.value })}
          />
        </Field>

        <label className="mb-2.5 flex items-center gap-2 text-small text-muted">
          <input
            type="checkbox"
            checked={form.recurring}
            onChange={(event) => setForm({ ...form, recurring: event.target.checked })}
          />
          Despesa fixa (se repete todo mês)
        </label>
      </div>

      <Button type="submit" size="sm" disabled={save.isPending}>
        {expense ? 'Salvar' : 'Adicionar despesa'}
      </Button>
    </form>
  )
}

/** BL-098: cadastro e histórico de despesas, com total por categoria no período em vista. */
export function ExpensesEditor() {
  const [key, setKey] = useState(() => defaultPeriodKey('month'))
  const { startDate, endDate } = periodRangeDateKeys('month', key)
  const { data: expenses, isLoading } = useExpensesInRange(startDate, endDate)
  const remove = useDeleteExpense()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const totalsByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const expense of expenses ?? [])
      map.set(expense.category, (map.get(expense.category) ?? 0) + expense.amount)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [expenses])

  const total = (expenses ?? []).reduce((sum, expense) => sum + expense.amount, 0)

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

      {totalsByCategory.length > 0 && (
        <div className="rounded-card border border-border bg-surface p-card">
          <div className="flex items-baseline justify-between gap-4">
            <Text size="caption" tone="muted" className="uppercase">
              Total do mês
            </Text>
            <Text size="body" className="font-semibold">
              {formatBRL(total)}
            </Text>
          </div>
          <ul className="mt-3 space-y-1.5">
            {totalsByCategory.map(([category, amount]) => (
              <li
                key={category}
                className="flex items-baseline justify-between gap-4 text-small text-muted"
              >
                <span>{EXPENSE_CATEGORY_LABELS[category as ExpenseRow['category']]}</span>
                <span>{formatBRL(amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isLoading && (
        <Text size="small" tone="muted">
          Carregando…
        </Text>
      )}

      <ul className="space-y-4">
        {expenses?.map((expense) =>
          editingId === expense.id ? (
            <ExpenseForm key={expense.id} expense={expense} onSaved={() => setEditingId(null)} />
          ) : (
            <li
              key={expense.id}
              className="flex items-start justify-between gap-4 rounded-card border border-border px-4 py-3"
            >
              <button
                type="button"
                onClick={() => setEditingId(expense.id)}
                className="min-w-0 flex-1 text-start"
              >
                <p className="text-small font-semibold text-foreground">{expense.description}</p>
                <p className="mt-0.5 text-caption text-muted">
                  {new Date(`${expense.expense_date}T00:00:00`).toLocaleDateString('pt-BR')} ·{' '}
                  {EXPENSE_CATEGORY_LABELS[expense.category]}
                  {expense.recurring && ' · fixa'}
                </p>
              </button>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-small font-semibold whitespace-nowrap">
                  {formatBRL(expense.amount)}
                </span>
                <button
                  type="button"
                  aria-label={`Remover ${expense.description}`}
                  onClick={() =>
                    confirmDelete(`a despesa ${expense.description}`) && remove.mutate(expense.id)
                  }
                  className="text-muted transition-control hover:text-foreground"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </div>
            </li>
          ),
        )}
      </ul>

      {expenses?.length === 0 && !isLoading && !adding && (
        <Text size="small" tone="muted">
          Nenhuma despesa cadastrada nesse mês.
        </Text>
      )}

      {adding ? (
        <ExpenseForm onSaved={() => setAdding(false)} />
      ) : (
        <Button type="button" variant="outline" onClick={() => setAdding(true)}>
          Nova despesa
        </Button>
      )}
    </div>
  )
}
