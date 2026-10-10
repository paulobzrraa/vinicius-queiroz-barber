import { useEffect, useState } from 'react'

/**
 * ID da seção atual entre as observadas, ou null se nenhuma foi alcançada
 * ainda (no Hero, por exemplo).
 *
 * A atual é a última cujo topo já passou da linha de leitura, a 40% da altura
 * da tela. No fim da página é sempre a última seção: ela pode ser curta demais
 * para o topo chegar à linha, mesmo com a página toda rolada.
 *
 * `ids` deve ser uma lista estável (constante de módulo). A ordem não importa:
 * as seções são ordenadas pela posição no documento.
 */
export function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    let frame = 0

    const update = () => {
      frame = 0

      // Reconsulta o DOM a cada medição, em vez de guardar a lista uma única
      // vez: uma seção com dado assíncrono (Serviços, Profissionais — ver
      // App.tsx) pode não existir ainda nas primeiras medições, e só entra
      // pra valer quando essa consulta rodar de novo depois dela montar.
      const sections = ids
        .map((id) => document.getElementById(id))
        .filter((element): element is HTMLElement => element !== null)
        .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
      if (sections.length === 0) return

      const readingLine = window.innerHeight * 0.4
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      const current = atBottom
        ? sections.at(-1)
        : sections.filter((section) => section.getBoundingClientRect().top <= readingLine).at(-1)

      setActive(current?.id ?? null)
    }

    // No máximo uma medição por quadro.
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)

    // Sem isto, só uma seção que aparece tarde (dado assíncrono) nunca
    // disparadaria uma nova medição até o próximo scroll/resize do usuário.
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [ids])

  return active
}
