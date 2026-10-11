import { Container, Heading, Section, Text } from '@/components/ui'
import { sectionIds } from '@/data'
import { useSiteSettings } from '@/queries/site'

/**
 * Texto institucional, centralizado. Some enquanto `about_body` não for
 * preenchido no admin. O GIF (`about_gif_url`, opcional) aparece embaixo do
 * texto, também centralizado — sem `object-cover`/altura fixa, pra não
 * cortar quadro nenhum: a altura da imagem é a do próprio arquivo.
 */
export function About() {
  const { data: site } = useSiteSettings()

  return (
    <Section id={sectionIds.about} aria-labelledby={`${sectionIds.about}-title`}>
      <Container>
        <div className="flex flex-col items-center gap-10 text-center">
          <div>
            <Heading id={`${sectionIds.about}-title`}>Sobre Nós</Heading>
            {site?.about_body && (
              <Text size="lead" tone="muted" className="scroll-reveal mx-auto mt-block max-w-text">
                {site.about_body}
              </Text>
            )}
          </div>

          {site?.about_gif_url && (
            <img
              src={site.about_gif_url}
              alt=""
              loading="lazy"
              decoding="async"
              className="scroll-reveal h-auto w-[22rem] max-w-full rounded-media"
            />
          )}
        </div>
      </Container>
    </Section>
  )
}
