/** Formata um telefone BR de 11 dígitos (DDD + 9 + número) para exibição. */
export function formatPhone(digits: string): string {
  const match = digits.match(/^(\d{2})(\d{5})(\d{4})$/)
  if (!match) return digits

  const [, ddd, prefix, suffix] = match
  return `(${ddd}) ${prefix}-${suffix}`
}

/** Só os dígitos de um telefone, até os 11 de um número BR (DDD + 9 + número). */
export function onlyPhoneDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11)
}

/** Máscara progressiva para o campo de telefone do formulário de agendamento. */
export function maskPhoneInput(value: string): string {
  const digits = onlyPhoneDigits(value)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

/** Link para abrir uma conversa no WhatsApp com um telefone BR de 11 dígitos (DDD + 9 + número). */
export function whatsappLink(digits: string): string {
  return `https://wa.me/55${digits}`
}
