import logo from '@/assets/brand/logo-color.png'
import { useSiteSettings } from '@/queries/site'
import { cn } from '@/utils/cn'

/**
 * Logo oficial da Vinicius Queiroz Barber, na versão colorida (cromo teal sobre
 * preto, recortada do perfil do Instagram com fundo transparente). Não é mais
 * uma máscara pintada com a cor do texto: a marca tem cor própria, então a
 * imagem é usada como está, nos dois tons.
 *
 * Defina o tamanho pela altura (h-10, h-16...); a largura acompanha (quadrada).
 */
export function Logo({ className, id }: { className?: string; id?: string }) {
  const { data: site } = useSiteSettings()

  return (
    <img
      id={id}
      src={logo}
      alt={site?.name ?? 'Vinicius Queiroz Barber'}
      width={600}
      height={600}
      decoding="async"
      className={cn('aspect-square w-auto', className)}
    />
  )
}
