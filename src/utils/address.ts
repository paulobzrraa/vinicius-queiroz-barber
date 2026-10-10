interface AddressFields {
  street: string | null
  neighborhood: string | null
  city: string
  state: string
}

/** Formata o endereço com o que já existir; cresce sozinho conforme os campos forem preenchidos. */
export function formatAddress(address: AddressFields): string {
  const cityLine = `${address.city}, ${address.state}`
  const streetLine = [address.street, address.neighborhood].filter(Boolean).join(', ')

  return streetLine ? `${streetLine} — ${cityLine}` : cityLine
}

interface MapAddressFields extends AddressFields {
  postal_code: string | null
  country: string
}

/**
 * URL de um mapa incorporável (iframe) sem precisar de chave de API — usa o
 * endereço como busca (`output=embed`), suportado pelo próprio Google Maps.
 * Só faz sentido com uma rua real: com só cidade/estado, o mapa ficaria
 * afastado demais pra ser útil, então quem chama decide se mostra ou não
 * (ver Footer.tsx, que exige `street`).
 */
export function buildMapEmbedUrl(address: MapAddressFields): string {
  const query = [
    address.street,
    address.neighborhood,
    `${address.city} - ${address.state}`,
    address.postal_code,
    address.country,
  ]
    .filter(Boolean)
    .join(', ')

  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`
}
