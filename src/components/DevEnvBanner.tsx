/**
 * Faixa só do `npm run dev` (o build de produção descarta este componente):
 * deixa claro em qual banco o localhost está gravando. `VITE_APP_ENV=test`
 * (em .env.development.local, apontando para o projeto Supabase de teste)
 * mostra o aviso discreto; sem isso, avisa em vermelho que os dados vão para
 * o banco de produção.
 */
export function DevEnvBanner() {
  if (!import.meta.env.DEV) return null

  const isTest = import.meta.env.VITE_APP_ENV === 'test'

  return (
    <div
      role="status"
      className={
        isTest
          ? 'pointer-events-none fixed bottom-3 left-3 z-[100] rounded-control bg-foreground/10 px-3 py-1 text-caption text-muted backdrop-blur'
          : 'pointer-events-none fixed bottom-3 left-3 z-[100] rounded-control bg-red-600 px-3 py-1 text-caption font-semibold text-white'
      }
    >
      {isTest ? 'Ambiente de teste' : '⚠ Banco de PRODUÇÃO'}
    </div>
  )
}
