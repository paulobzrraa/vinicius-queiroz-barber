import { FaFacebook, FaInstagram, FaTiktok, FaYoutube } from 'react-icons/fa6'

import type { SocialPlatform } from '@/lib/database.types'

const icons: Record<SocialPlatform, typeof FaInstagram> = {
  instagram: FaInstagram,
  facebook: FaFacebook,
  tiktok: FaTiktok,
  youtube: FaYoutube,
}

/** Logo da rede social, no lugar do nome por extenso (o link/handle já diz qual é). */
export function SocialIcon({
  platform,
  className,
}: {
  platform: SocialPlatform
  className?: string
}) {
  const Icon = icons[platform]
  return <Icon aria-hidden="true" className={className} />
}
