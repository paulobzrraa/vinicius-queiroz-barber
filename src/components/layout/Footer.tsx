import { m } from 'motion/react'

import { fadeIn } from '@/animations'
import { Logo } from '@/components/Logo'
import { Container, Eyebrow, Text } from '@/components/ui'
import { navigation, sectionIds } from '@/data'
import { useContactSettings, useSocialLinks } from '@/queries/contact'
import { useSiteSettings } from '@/queries/site'
import { buildMapEmbedUrl, formatAddress } from '@/utils/address'
import { cn } from '@/utils/cn'
import { socialLabels } from '@/utils/social'

/**
 * Rodapé: identidade, navegação principal, redes sociais (só quando
 * configuradas), localização e copyright. Reaproveita `navigation` (estática)
 * e os dados de contato/site do admin, as mesmas fontes do Header e da seção
 * de Contato.
 */
export function Footer() {
  const { data: site } = useSiteSettings()
  const { data: contact } = useContactSettings()
  const { data: socials } = useSocialLinks()
  if (!site || !contact || !socials) return null
  const hasSocials = socials.length > 0

  return (
    <footer className="border-t border-border">
      <Container className="py-16">
        <m.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={fadeIn}
          className={cn(
            // Se o total de blocos for ímpar (sem redes sociais, por exemplo), o
            // último some sozinho numa grade de 2 colunas — o `nth-child(odd)`
            // faz ele ocupar a linha toda só nesse caso, sem afetar o `lg`.
            'grid gap-x-8 gap-y-10 sm:grid-cols-2 sm:[&>*:last-child:nth-child(odd)]:col-span-2',
            hasSocials ? 'lg:grid-cols-4' : 'lg:grid-cols-3',
            'lg:[&>*:last-child:nth-child(odd)]:col-span-1',
          )}
        >
          <div>
            <a href={`#${sectionIds.hero}`} className="inline-block rounded-sm">
              <Logo className="h-27" />
            </a>
          </div>

          <nav aria-label="Rodapé">
            <Eyebrow>Navegação</Eyebrow>
            <ul className="mt-4 flex flex-col gap-3">
              {navigation.map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="link-nav text-small">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {hasSocials && (
            <div>
              <Eyebrow>Redes sociais</Eyebrow>
              <ul className="mt-4 flex flex-col gap-3">
                {socials.map((social) => (
                  <li key={social.id}>
                    <a
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link-nav text-small"
                    >
                      {socialLabels[social.platform]}
                      <span className="sr-only"> (abre em nova aba)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <Eyebrow>Localização</Eyebrow>
            <Text size="small" tone="muted" className="mt-4">
              {formatAddress(contact)}
            </Text>

            {/* Só com rua confirmada: só cidade/estado deixaria o mapa afastado
                demais pra ser útil (endereço completo ainda pendente, BL-099). */}
            {contact.street && (
              <iframe
                title="Mapa de localização da Vinicius Queiroz Barber"
                src={buildMapEmbedUrl(contact)}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="mt-4 h-48 w-full rounded-media border border-border"
              />
            )}
          </div>
        </m.div>

        <div className="mt-16 border-t border-border pt-8">
          <Text size="caption" tone="muted">
            © {new Date().getFullYear()} {site.name}
          </Text>
        </div>
      </Container>
    </footer>
  )
}
