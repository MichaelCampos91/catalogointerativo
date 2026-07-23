/**
 * Constantes compartilhadas (client + server) para expiração de links.
 * Sem dependências de banco — seguro para importar em componentes client.
 */

export const LINK_EXPIRATION_KEY_ENABLED = "link_expiration_enabled"
export const LINK_EXPIRATION_KEY_MINUTES = "link_expiration_minutes"
export const LINK_EXPIRATION_KEY_MESSAGE = "link_expiration_message"

export const LINK_EXPIRATION_DEFAULT_ENABLED = false
export const LINK_EXPIRATION_DEFAULT_MINUTES = 1440 // 24 horas
export const LINK_EXPIRATION_DEFAULT_MESSAGE =
  "O prazo para escolher os itens deste pedido expirou. Entre em contato com a Cenario caso precise de ajuda."

export const LINK_EXPIRATION_MIN_MINUTES = 1
export const LINK_EXPIRATION_MAX_MINUTES = 60 * 24 * 30 // 30 dias
export const LINK_EXPIRATION_MAX_MESSAGE_LENGTH = 2000

export type LinkExpirationSettings = {
  enabled: boolean
  minutes: number
  message: string
}
