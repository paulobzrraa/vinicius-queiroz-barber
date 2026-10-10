import logo from '@/assets/brand/logo.svg'
import { useSiteSettings } from '@/queries/site'
import { cn } from '@/utils/cn'

/** Proporção (largura / altura) do desenho da logo, para reservar o espaço antes de carregar. */
const LOGO_ASPECT = 1536 / 560

/**
 * Logo oficial da Vinicius Queiroz Barber. O arquivo é só uma máscara (o formato das
 * letras), pintada com a cor do texto atual: fica branca no tom escuro e
 * preta (#191919) no tom claro, sem precisar de duas versões.
 *
 * Defina o tamanho pela altura (h-9, h-10...); a largura acompanha.
 *
 * O traço veio do perfil do Instagram o perfil oficial da marca, que só existe em
 * 150px — pixel a pixel, isso ficaria borrado em qualquer uso grande (Hero).
 * Por isso o arquivo é um SVG (src/assets/brand/logo.svg), vetorizado a
 * partir daquele PNG com potrace: por ser vetor, a máscara é recalculada no
 * tamanho de tela renderizado, então fica nítida em qualquer altura — ao
 * contrário de um PNG, que teria um limite real de resolução. Se um dia
 * existir uma versão vetorial oficial da marca, é só trocar este arquivo.
 */
export function Logo({ className, id }: { className?: string; id?: string }) {
  const { data: site } = useSiteSettings()

  return (
    <span
      id={id}
      role="img"
      aria-label={site?.name ?? 'Vinicius Queiroz Barber'}
      className={cn('block bg-current', className)}
      style={{
        aspectRatio: LOGO_ASPECT,
        maskImage: `url(${logo})`,
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'left center',
      }}
    />
  )
}
