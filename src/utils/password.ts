/** Mesma regra de password_is_weak (supabase/schema.sql): 8 a 72 caracteres, sem repetir um só caractere, sem senhas óbvias. */
export const PASSWORD_MIN_LENGTH = 8

/** Dica mostrada onde o cliente cria ou troca a senha. */
export const PASSWORD_HINT =
  'Mínimo de 8 caracteres. Misture letras e números e evite sequências ou senhas óbvias, como 12345678.'
