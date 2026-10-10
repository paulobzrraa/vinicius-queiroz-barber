import { X } from 'lucide-react'
import { useState, type ComponentPropsWithoutRef, type ReactNode } from 'react'

import { cn } from '@/utils/cn'

const inputClasses =
  'mt-1 block w-full rounded-card border border-border bg-surface px-4 py-2.5 text-body text-foreground outline-none transition-control focus:border-border-strong'

interface FieldProps {
  label: string
  hint?: string
  children: ReactNode
  className?: string
}

/** Rótulo + controle de formulário, no mesmo estilo em todo o admin. */
export function Field({ label, hint, children, className }: FieldProps) {
  return (
    <label className={cn('block', className)}>
      <span className="text-small text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-caption text-muted">{hint}</span>}
    </label>
  )
}

export function TextInput(props: ComponentPropsWithoutRef<'input'>) {
  return <input {...props} className={cn(inputClasses, props.className)} />
}

interface DateTimeInputProps {
  /** Mesmo formato do value nativo de type="datetime-local": "AAAA-MM-DDTHH:mm". */
  value: string
  onChange: (event: { target: { value: string } }) => void
  required?: boolean
  className?: string
}

/**
 * Como TextInput, só que para um valor de data+hora. Em vez do widget único
 * type="datetime-local", usa dois campos nativos separados — date e time —
 * mantendo o mesmo formato de valor ("AAAA-MM-DDTHH:mm") pra quem chama não
 * precisar mudar nada.
 *
 * Confirmado em aparelho: no iOS, o controle combinado de data+hora às
 * vezes ignora a largura em CSS e estoura a tela — um limite da
 * plataforma, não um bug de layout (reduzir fonte/padding não resolve,
 * porque o problema é o próprio widget, não o espaço disponível). Os
 * campos separados não têm esse problema — o type="time" de Horário de
 * funcionamento, por exemplo, já funciona bem no mobile.
 *
 * O valor só existe no formato combinado quando os dois campos estão
 * preenchidos — por isso guarda data e hora em estado próprio (em vez de
 * derivar só do `value`): selecionar a data sozinha, antes da hora, não tem
 * um "AAAA-MM-DDTHH:mm" válido pra mandar pra quem chama, mas o campo de
 * data precisa continuar mostrando o que foi escolhido mesmo assim.
 *
 * Resincroniza os dois campos quando `value` muda por fora (ex.: o
 * formulário limpa os campos depois de salvar) comparando com o valor
 * anterior durante a própria renderização, em vez de um useEffect — assim
 * não tem um re-render extra toda vez que alguém mexe num dos dois campos.
 */
export function DateTimeInput({ value, onChange, required, className }: DateTimeInputProps) {
  const [datePart, setDatePart] = useState(() => value.split('T')[0] ?? '')
  const [timePart, setTimePart] = useState(() => value.split('T')[1] ?? '')
  const [prevValue, setPrevValue] = useState(value)
  // No iOS, limpar o value de um type="date" por código às vezes não limpa o
  // que aparece no campo (ele "trava" mostrando a data antiga) — trocar essa
  // chave força o React a recriar o <input> do zero ao limpar, em vez de só
  // atualizar o value do que já existe.
  const [resetKey, setResetKey] = useState(0)

  if (value !== prevValue) {
    setPrevValue(value)
    const [nextDate = '', nextTime = ''] = value ? value.split('T') : []
    setDatePart(nextDate)
    setTimePart(nextTime)
  }

  function emit(nextDate: string, nextTime: string) {
    setDatePart(nextDate)
    setTimePart(nextTime)
    onChange({ target: { value: nextDate && nextTime ? `${nextDate}T${nextTime}` : '' } })
  }

  function clear() {
    setResetKey((key) => key + 1)
    emit('', '')
  }

  return (
    // flex-wrap: cada campo nativo (date, time) tem uma largura mínima pra
    // não cortar o próprio conteúdo (o calendário/relógio do desktop precisa
    // de mais espaço que no mobile); se não couber lado a lado, os dois
    // quebram linha dentro do próprio componente em vez de ficarem ilegíveis.
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <input
        key={`date-${resetKey}`}
        type="date"
        required={required}
        value={datePart}
        onChange={(event) => emit(event.target.value, timePart)}
        className={cn(inputClasses, 'min-w-36 flex-1 px-3 text-small')}
      />
      <input
        key={`time-${resetKey}`}
        type="time"
        required={required}
        value={timePart}
        onChange={(event) => emit(datePart, event.target.value)}
        className={cn(inputClasses, 'min-w-28 flex-1 px-3 text-small')}
      />
      {(datePart || timePart) && (
        <button
          type="button"
          onClick={(event) => {
            // O Field envolve tudo num único <label>; sem isto, o clique
            // também dispara o comportamento padrão do label de ativar o
            // primeiro controle associado (o campo de data), abrindo o
            // seletor nativo de novo em vez de só limpar.
            event.preventDefault()
            clear()
          }}
          aria-label="Limpar data e hora"
          className="mt-1 shrink-0 text-muted transition-control hover:text-foreground"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  )
}

export function TextArea(props: ComponentPropsWithoutRef<'textarea'>) {
  return <textarea {...props} className={cn(inputClasses, 'min-h-24 resize-y', props.className)} />
}

export function Select(props: ComponentPropsWithoutRef<'select'>) {
  // .select-chevron (styles/utilities.css) troca a seta nativa, colada na borda, por uma com folga.
  return <select {...props} className={cn(inputClasses, 'select-chevron', props.className)} />
}
