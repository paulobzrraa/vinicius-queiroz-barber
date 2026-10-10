import type { SocialPlatform } from '@/lib/database.types'

export const socialLabels: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
}

/** Extrai o @handle a partir da URL do perfil, para exibição. */
export function socialHandle(url: string): string {
  try {
    const segment = new URL(url).pathname.replace(/\/+$/, '').split('/').pop()
    return segment ? `@${segment}` : url
  } catch {
    return url
  }
}
