import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { domAnimation, LazyMotion, MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

// Inter com tamanhos ópticos: fonte dos aparelhos sem SF Pro (ver --font-sans).
// O navegador só baixa o subset usado (latin).
import '@fontsource-variable/inter/opsz.css'
// Jost: fonte dos títulos (ver --font-display em tokens.css). Só os dois
// pesos usados na escala de títulos (600 e 700).
import '@fontsource/jost/600.css'
import '@fontsource/jost/700.css'
import '@/styles/index.css'

import { AppRoutes } from '@/AppRoutes'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Elemento #root nao encontrado no index.html')
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
})

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/* reducedMotion="user": toda animação do Motion respeita prefers-reduced-motion (BL-036). */}
        <MotionConfig reducedMotion="user">
          {/*
            LazyMotion carrega só os recursos de animação usados (domAnimation: animate,
            variants, whileInView), não o Motion inteiro (arrastar e layout ficam de fora).
            Por isso os componentes são `m.*`, não `motion.*`; strict acusa o uso errado em dev.
          */}
          <LazyMotion features={domAnimation} strict>
            <AppRoutes />
          </LazyMotion>
        </MotionConfig>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
