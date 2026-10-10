import { useState } from 'react'
import { FaGoogle } from 'react-icons/fa6'

import { Button } from '@/components/ui'
import { signInWithGoogle } from '@/queries/clientAuth'

interface GoogleButtonProps {
  /** Caminho (com ?query) para onde o Google devolve o cliente já logado. */
  returnPath: string
  className?: string
}

/** "Continuar com Google": redireciona para o Google e volta para `returnPath`. */
export function GoogleButton({ returnPath, className }: GoogleButtonProps) {
  const [error, setError] = useState(false)

  async function handleClick() {
    setError(false)
    try {
      await signInWithGoogle(returnPath)
    } catch {
      setError(true)
    }
  }

  return (
    <div className={className}>
      <Button variant="outline" iconStart={<FaGoogle />} onClick={handleClick} className="w-full">
        Continuar com Google
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-center text-caption text-muted">
          Não foi possível abrir o Google. Tente de novo.
        </p>
      )}
    </div>
  )
}
