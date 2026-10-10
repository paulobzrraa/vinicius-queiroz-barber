import { useMutation, useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type {
  ChangePasswordResult,
  ClientCredentialsStatus,
  ClientLoginResult,
} from '@/lib/database.types'

/** E-mail ou senha incorretos. */
export class InvalidCredentialsError extends Error {
  constructor() {
    super('invalid_credentials')
  }
}

/** Conta bloqueada por erros seguidos de senha; `retryAfterSeconds` vem do banco. */
export class AccountLockedError extends Error {
  retryAfterSeconds: number

  constructor(retryAfterSeconds = 900) {
    super('account_locked')
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export type AccessAppointment = Extract<ClientLoginResult, { ok: true }>['appointments'][number]

/**
 * Login de "Meus agendamentos" (e-mail + senha). É uma conta própria do
 * banco (client_login), sem sessão do Supabase Auth: o cliente continua `anon`
 * e nunca alcança o admin. Devolve os próximos agendamentos da conta, cada um
 * com o link único (access_token).
 */
export function useClientLogin() {
  return useMutation({
    mutationFn: async (input: {
      email: string
      password: string
    }): Promise<AccessAppointment[]> => {
      const { data, error } = await supabase.rpc('client_login', {
        p_email: input.email,
        p_password: input.password,
      })
      if (error) throw error
      if (!data.ok) {
        if (data.locked) throw new AccountLockedError(data.retry_after_seconds)
        throw new InvalidCredentialsError()
      }
      return data.appointments
    },
  })
}

/**
 * Confere e-mail + senha no passo "Seus dados", antes de agendar: avisa na hora
 * se a senha não bate com a conta daquele e-mail (ou se o e-mail ainda não tem
 * conta e o agendamento vai criá-la). Erros de senha contam para o bloqueio.
 */
export function useCheckClientCredentials() {
  return useMutation({
    mutationFn: async (input: {
      email: string
      password: string
    }): Promise<ClientCredentialsStatus> => {
      const { data, error } = await supabase.rpc('check_client_credentials', {
        p_email: input.email,
        p_password: input.password,
      })
      if (error) throw error
      return data
    },
  })
}

/**
 * Troca de senha de quem tem conta por e-mail + senha. Exige a senha atual a
 * cada vez (conferida no banco, com a mesma contagem de erros e bloqueio do
 * login): ter a tela aberta não basta para trocar a senha.
 */
export function useChangeClientPassword() {
  return useMutation({
    mutationFn: async (input: {
      email: string
      currentPassword: string
      newPassword: string
    }): Promise<ChangePasswordResult> => {
      const { data, error } = await supabase.rpc('change_client_password', {
        p_email: input.email,
        p_current_password: input.currentPassword,
        p_new_password: input.newPassword,
      })
      if (error) throw error
      return data
    },
  })
}

/**
 * O e-mail já tem conta? Usado no passo "Seus dados": só quem ainda não tem
 * conta precisa criar uma senha. Passe `''` para não consultar.
 */
export function useClientAccountExists(email: string) {
  return useQuery({
    queryKey: ['client_account_exists', email],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc('client_account_exists', { p_email: email })
      if (error) throw error
      return data
    },
    enabled: email !== '',
    // Uma conta pode ser criada a qualquer momento: não reaproveita resposta velha por muito tempo.
    staleTime: 10_000,
  })
}
