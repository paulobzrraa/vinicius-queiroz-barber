import { CalendarPlus, Check, Copy } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { fadeInUp, sealContent } from '@/animations'
import { StatusSeal } from '@/components/StatusSeal'
import { Button, Heading, Text } from '@/components/ui'
import type { AppointmentRow } from '@/queries/appointments'
import { useClientSession } from '@/queries/clientAuth'
import { useSiteSettings } from '@/queries/site'
import { downloadIcsFile } from '@/utils/ics'
import { formatDateTimeLabel } from '@/utils/timezone'

interface SuccessStepProps {
  appointment: AppointmentRow
  serviceNames: string[]
  professionalName: string
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-3 first:pt-0 last:pb-0">
      <Text size="caption" tone="muted" className="shrink-0 uppercase">
        {label}
      </Text>
      <div className="text-end">{children}</div>
    </div>
  )
}

/** BL-072: confirmação final, com .ics para adicionar ao calendário e o link que dá acesso
 * ao agendamento sem login (BL-058), onde o cliente também cancela ou reagenda (BL-078/079). */
export function SuccessStep({ appointment, serviceNames, professionalName }: SuccessStepProps) {
  const { data: site } = useSiteSettings()
  const reducedMotion = useReducedMotion()
  const google = useClientSession()
  const animated = !reducedMotion
  const headingRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  // BL-108: mesmo critério das outras etapas — o foco vai para o título novo.
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  const manageUrl = `${window.location.origin}/agendamento/${appointment.access_token}`
  const firstName = appointment.client_name.split(' ')[0]

  function handleAddToCalendar() {
    downloadIcsFile('agendamento-vinicius-queiroz-barber.ics', {
      title: `${site?.name ?? 'Vinicius Queiroz Barber'} — horário marcado`,
      startsAt: appointment.starts_at,
      endsAt: appointment.ends_at,
    })
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(manageUrl)
      setCopied(true)
    } catch {
      // Sem permissão de área de transferência: o link continua no botão "Ver meu agendamento".
    }
  }

  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <StatusSeal variant="success" animated={animated} />

      <motion.div
        initial={animated ? 'hidden' : false}
        animate="visible"
        variants={sealContent}
        className="flex w-full flex-col items-center gap-8"
      >
        <motion.div variants={fadeInUp}>
          <div ref={headingRef} tabIndex={-1} className="outline-none">
            <Heading as="h1" size="title-3">
              Agendamento confirmado
            </Heading>
          </div>
          <Text size="body" tone="muted" className="mt-2">
            Tudo certo, {firstName}. Esperamos você!
          </Text>
        </motion.div>

        <motion.div
          variants={fadeInUp}
          className="w-full rounded-card border border-border bg-surface p-card text-start"
        >
          <Text size="lead" className="font-semibold capitalize">
            {formatDateTimeLabel(appointment.starts_at)}
          </Text>

          <div className="mt-5 divide-y divide-border border-t border-border pt-5">
            <DetailRow label={serviceNames.length > 1 ? 'Serviços' : 'Serviço'}>
              <Text size="small">{serviceNames.join(', ')}</Text>
            </DetailRow>
            {professionalName && (
              <DetailRow label="Profissional">
                <Text size="small">{professionalName}</Text>
              </DetailRow>
            )}
          </div>
        </motion.div>

        <motion.div variants={fadeInUp} className="flex w-full flex-col gap-3">
          <Button href={manageUrl} size="lg">
            Ver meu agendamento
          </Button>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="outline"
              iconStart={<CalendarPlus />}
              onClick={handleAddToCalendar}
              className="sm:flex-1"
            >
              Adicionar ao calendário
            </Button>
            <Button
              variant="outline"
              iconStart={copied ? <Check /> : <Copy />}
              onClick={handleCopy}
              className="sm:flex-1"
            >
              {copied ? 'Link copiado' : 'Copiar link'}
            </Button>
          </div>
        </motion.div>

        <motion.div variants={fadeInUp} className="flex flex-col items-center gap-2">
          <Text size="caption" tone="muted" className="max-w-text">
            {appointment.client_account_id
              ? 'Consulte depois em Meus agendamentos, com seu e-mail e senha.'
              : appointment.client_email && appointment.client_email === google.verifiedEmail
                ? 'Consulte depois em Meus agendamentos, entrando com o Google.'
                : appointment.client_email
                  ? 'A senha não confere com a conta desse e-mail, então este agendamento não aparece em Meus agendamentos. Guarde o link para ver, reagendar ou cancelar.'
                  : 'Guarde o link para ver, reagendar ou cancelar.'}
          </Text>
        </motion.div>
      </motion.div>
    </div>
  )
}
