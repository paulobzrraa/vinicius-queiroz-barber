/*
 * Prévia do design system, servida em /design-system.html só no `npm run dev`.
 * O build de produção compila apenas o index.html, então esta página não é publicada.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@fontsource-variable/inter/opsz.css'
import '@fontsource/jost/600.css'
import '@fontsource/jost/700.css'
import '@/styles/index.css'

import { DesignSystemPreview } from './DesignSystemPreview'

// A Logo lê o nome do site do Supabase (useSiteSettings); precisa do mesmo provider do main.tsx.
const queryClient = new QueryClient()

// ?fonte=inter mostra a página como Android e Windows a veem (Inter em vez de SF Pro).
if (new URLSearchParams(window.location.search).get('fonte') === 'inter') {
  document.documentElement.style.setProperty('--font-sans', "'Inter Variable', sans-serif")
}

const root = document.getElementById('root')

if (!root) {
  throw new Error('Elemento #root não encontrado no design-system.html')
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <DesignSystemPreview />
    </QueryClientProvider>
  </StrictMode>,
)
