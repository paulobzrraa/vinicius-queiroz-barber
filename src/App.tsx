import { Footer, Header } from '@/components/layout'
import { ScrollAura } from '@/components/motion/ScrollAura'
import { ScrollProgress } from '@/components/motion/ScrollProgress'
import { useBookingSettings } from '@/queries/booking'
import { useContactSettings, useOpeningHours, useSocialLinks } from '@/queries/contact'
import { useGalleryImages } from '@/queries/gallery'
import { useActiveServices } from '@/queries/services'
import { useSiteSettings } from '@/queries/site'
import {
  About,
  Booking,
  Contact,
  Gallery,
  Hero,
  Professionals,
  Services,
  Testimonials,
} from '@/sections'

/**
 * Espera o conteúdo essencial carregar do Supabase antes de montar a página.
 * As seções chamam os mesmos hooks (React Query cacheia por chave, então não
 * refaz a requisição) — este componente só evita o flash de layout parcial
 * enquanto os dados ainda não chegaram.
 *
 * Profissionais (BL-092) e Depoimentos (BL-023) ficam de fora desse gate de
 * propósito: são seções opcionais que já sabem sumir sozinhas sem dado (ver
 * Professionals.tsx/Testimonials.tsx) — se entrassem aqui, uma tabela nova
 * ainda não aplicada no banco (ou qualquer erro nela) travaria a página
 * inteira em branco, não só aquela seção.
 */
export function App() {
  const site = useSiteSettings()
  const contact = useContactSettings()
  const hours = useOpeningHours()
  const socials = useSocialLinks()
  const booking = useBookingSettings()
  const services = useActiveServices()
  const gallery = useGalleryImages()

  const loading = [site, contact, hours, socials, booking, services, gallery].some(
    (query) => query.isLoading,
  )

  if (loading) return <div className="min-h-dvh bg-background" />

  return (
    <>
      <ScrollProgress />
      <ScrollAura />
      <Header />
      {/* tabIndex -1 permite receber o foco do link "Pular para o conteúdo". */}
      <main id="conteudo" tabIndex={-1} className="outline-none">
        <Hero />
        <About />
        <Services />
        <Professionals />
        <Gallery />
        <Testimonials />
        <Booking />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
