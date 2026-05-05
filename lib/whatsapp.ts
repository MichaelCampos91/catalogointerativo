/**
 * Números da Cenário em formato internacional (E.164 sem o `+`).
 * Centralizados aqui para que mudar um número futuramente seja uma
 * alteração em um único lugar.
 */
export const WHATSAPP_NUMBERS = {
  /** Linha de orçamento de painéis sublimados sob medida. */
  orcamento: "5518997264861",
  /** Linha do Grupo VIP para decoradores. */
  vip: "5518997003934",
} as const

/**
 * Compatibilidade: número padrão historicamente usado pelo helper. Aponta
 * para o Grupo VIP, que era o destino original do `WHATSAPP_NUMBER`.
 */
export const WHATSAPP_NUMBER = WHATSAPP_NUMBERS.vip

/**
 * Monta uma URL `wa.me` com a mensagem pré-preenchida. A mensagem é
 * URI-encoded, então pode conter quebras de linha, acentos e emojis.
 *
 * @param message Texto a ser pré-preenchido na conversa.
 * @param number  Número de destino em formato E.164 sem `+`. Default:
 *                `WHATSAPP_NUMBERS.vip`.
 *
 * @example
 * buildWhatsAppLink("Olá, quero entrar no Grupo VIP para decoradores.")
 * // → https://wa.me/5518997003934?text=Ol%C3%A1%2C+quero+entrar...
 *
 * buildWhatsAppLink("Olá, gostaria de fazer um orçamento.", WHATSAPP_NUMBERS.orcamento)
 * // → https://wa.me/5518997264861?text=...
 */
export function buildWhatsAppLink(
  message: string,
  number: string = WHATSAPP_NUMBERS.vip,
): string {
  const text = encodeURIComponent(message)
  return `https://wa.me/${number}?text=${text}`
}
