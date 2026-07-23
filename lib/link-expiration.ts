import {
  getAppSetting,
  getAppSettingBoolean,
} from "@/lib/database"
import {
  LINK_EXPIRATION_DEFAULT_ENABLED,
  LINK_EXPIRATION_DEFAULT_MESSAGE,
  LINK_EXPIRATION_DEFAULT_MINUTES,
  LINK_EXPIRATION_KEY_ENABLED,
  LINK_EXPIRATION_KEY_MESSAGE,
  LINK_EXPIRATION_KEY_MINUTES,
  LINK_EXPIRATION_MAX_MINUTES,
  LINK_EXPIRATION_MIN_MINUTES,
  type LinkExpirationSettings,
} from "@/lib/link-expiration-constants"

export type { LinkExpirationSettings }
export {
  LINK_EXPIRATION_DEFAULT_ENABLED,
  LINK_EXPIRATION_DEFAULT_MESSAGE,
  LINK_EXPIRATION_DEFAULT_MINUTES,
  LINK_EXPIRATION_KEY_ENABLED,
  LINK_EXPIRATION_KEY_MESSAGE,
  LINK_EXPIRATION_KEY_MINUTES,
  LINK_EXPIRATION_MAX_MESSAGE_LENGTH,
  LINK_EXPIRATION_MAX_MINUTES,
  LINK_EXPIRATION_MIN_MINUTES,
} from "@/lib/link-expiration-constants"

/**
 * Lê as configurações globais de expiração de links a partir de app_settings.
 * Defaults seguros: expiração desativada. Somente server-side.
 */
export async function getLinkExpirationSettings(): Promise<LinkExpirationSettings> {
  const [enabled, minutesRaw, messageRaw] = await Promise.all([
    getAppSettingBoolean(LINK_EXPIRATION_KEY_ENABLED, LINK_EXPIRATION_DEFAULT_ENABLED),
    getAppSetting(LINK_EXPIRATION_KEY_MINUTES),
    getAppSetting(LINK_EXPIRATION_KEY_MESSAGE),
  ])

  let minutes = LINK_EXPIRATION_DEFAULT_MINUTES
  if (minutesRaw !== null && minutesRaw !== undefined) {
    const parsed = Number.parseInt(minutesRaw, 10)
    if (
      Number.isInteger(parsed) &&
      parsed >= LINK_EXPIRATION_MIN_MINUTES &&
      parsed <= LINK_EXPIRATION_MAX_MINUTES
    ) {
      minutes = parsed
    }
  }

  const message =
    typeof messageRaw === "string" && messageRaw.trim()
      ? messageRaw
      : LINK_EXPIRATION_DEFAULT_MESSAGE

  return { enabled, minutes, message }
}
