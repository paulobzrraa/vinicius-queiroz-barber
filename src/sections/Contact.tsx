import { ArrowUpRight, AtSign, Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'

import { fadeInUp } from '@/animations'
import { SocialIcon } from '@/components/SocialIcon'
import { Button, Card, Container, Heading, Reveal, Section, Text } from '@/components/ui'
import { sectionIds } from '@/data'
import { useContactSettings, useOpeningHours, useSocialLinks } from '@/queries/contact'
import { formatAddress } from '@/utils/address'
import { groupStructuredHours } from '@/utils/openingHours'
import { formatPhone } from '@/utils/phone'
import { socialHandle, socialLabels } from '@/utils/social'

interface ContactCta {
  href: string
  label: string
  /** Sai do site: abre em nova aba (mapa, WhatsApp, redes sociais). */
  external?: boolean
}

interface ContactCardProps {
  icon: ReactNode
  label: string
  cta?: ContactCta
  children: ReactNode
}

/**
 * Card de um canal de contato. Só vira `interactive` (hover elevado) quando
 * tem um CTA de verdade dentro — sem link, é só informativo.
 */
function ContactCard({ icon, label, cta, children }: ContactCardProps) {
  return (
    <Card interactive={Boolean(cta)} className="flex h-full flex-col">
      <div aria-hidden="true" className="text-muted">
        {icon}
      </div>
      <Heading as="h3" size="title-4" className="mt-6">
        {label}
      </Heading>
      <div className="mt-2 flex-1">{children}</div>

      {cta && (
        <Button
          href={cta.href}
          variant="outline"
          size="sm"
          iconEnd={cta.external ? <ArrowUpRight /> : undefined}
          className="mt-6 self-start"
          {...(cta.external && { target: '_blank', rel: 'noopener noreferrer' })}
        >
          {cta.label}
          {cta.external && <span className="sr-only"> (abre em nova aba)</span>}
        </Button>
      )}
    </Card>
  )
}

/**
 * Canais de contato da barbearia. Cada card só aparece quando o dado real
 * existir (ver src/data/contact.ts) — nada de endereço, WhatsApp, horário ou
 * link inventado. Conforme a barbearia confirma mais dados, mais cards
 * aparecem sozinhos, sem mudar este componente.
 */
export function Contact() {
  const { data: contact } = useContactSettings()
  const { data: openingHours } = useOpeningHours()
  const { data: socials } = useSocialLinks()
  if (!contact || !openingHours || !socials) return null
  const { phone, whatsapp, email } = contact

  // BL-093: prioriza os dias estruturados (weekday/opens_at/closes_at), agrupados
  // em faixas ("Segunda a Sábado"); só cai no texto livre se não houver nenhum.
  const structuredLines = groupStructuredHours(openingHours)
  const hoursLines =
    structuredLines.length > 0
      ? structuredLines
      : openingHours.map((item) => ({ label: item.days, hours: item.hours }))

  return (
    <Section id={sectionIds.contact} aria-labelledby={`${sectionIds.contact}-title`}>
      <Container>
        <Heading id={`${sectionIds.contact}-title`} className="text-center">
          Contato
        </Heading>

        <Reveal
          as="ul"
          className="mt-block grid gap-6 sm:grid-cols-2 lg:grid-cols-3 sm:[&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-1"
        >
          <motion.li variants={fadeInUp}>
            <ContactCard
              icon={<MapPin className="size-6" />}
              label="Endereço"
              cta={
                contact.maps_url
                  ? { href: contact.maps_url, label: 'Como chegar', external: true }
                  : undefined
              }
            >
              <Text size="small" tone="muted">
                {formatAddress(contact)}
              </Text>
            </ContactCard>
          </motion.li>

          {phone && (
            <motion.li variants={fadeInUp}>
              <ContactCard
                icon={<Phone className="size-6" />}
                label="Telefone"
                cta={{ href: `tel:+55${phone}`, label: 'Ligar' }}
              >
                <Text size="small" tone="muted">
                  {formatPhone(phone)}
                </Text>
              </ContactCard>
            </motion.li>
          )}

          {whatsapp && (
            <motion.li variants={fadeInUp}>
              <ContactCard
                icon={<MessageCircle className="size-6" />}
                label="WhatsApp"
                cta={{
                  href: `https://wa.me/${whatsapp}`,
                  label: 'Enviar mensagem',
                  external: true,
                }}
              >
                <Text size="small" tone="muted">
                  {formatPhone(whatsapp)}
                </Text>
              </ContactCard>
            </motion.li>
          )}

          {email && (
            <motion.li variants={fadeInUp}>
              <ContactCard
                icon={<Mail className="size-6" />}
                label="E-mail"
                cta={{ href: `mailto:${email}`, label: 'Enviar e-mail' }}
              >
                <Text size="small" tone="muted">
                  {email}
                </Text>
              </ContactCard>
            </motion.li>
          )}

          {hoursLines.length > 0 && (
            <motion.li variants={fadeInUp}>
              <ContactCard icon={<Clock className="size-6" />} label="Horário de funcionamento">
                <ul className="space-y-1">
                  {hoursLines.map((line) => (
                    <li
                      key={line.label}
                      className="flex justify-between gap-4 text-small text-muted"
                    >
                      <span>{line.label}</span>
                      <span>{line.hours}</span>
                    </li>
                  ))}
                </ul>
              </ContactCard>
            </motion.li>
          )}

          {socials.length > 0 && (
            <motion.li variants={fadeInUp}>
              <ContactCard icon={<AtSign className="size-6" />} label="Redes sociais">
                <ul className="space-y-3">
                  {socials.map((social) => (
                    <li key={social.id}>
                      <a
                        href={social.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-small"
                      >
                        <SocialIcon platform={social.platform} className="size-4 shrink-0" />
                        <span className="link">
                          <span className="sr-only">{socialLabels[social.platform]}: </span>
                          {socialHandle(social.url)}
                        </span>
                        <span className="sr-only"> (abre em nova aba)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </ContactCard>
            </motion.li>
          )}
        </Reveal>
      </Container>
    </Section>
  )
}
