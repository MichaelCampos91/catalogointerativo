import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { upsertAppSetting } from "@/lib/database"
import { requireAuth, authErrorResponse } from "@/lib/auth"
import {
  getLinkExpirationSettings,
  LINK_EXPIRATION_DEFAULT_MESSAGE,
  LINK_EXPIRATION_KEY_ENABLED,
  LINK_EXPIRATION_KEY_MESSAGE,
  LINK_EXPIRATION_KEY_MINUTES,
  LINK_EXPIRATION_MAX_MESSAGE_LENGTH,
  LINK_EXPIRATION_MAX_MINUTES,
  LINK_EXPIRATION_MIN_MINUTES,
} from "@/lib/link-expiration"

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const cookieToken = cookieStore.get("auth_token")?.value
    await requireAuth(request, cookieToken)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token não fornecido"
    return authErrorResponse(msg, 401)
  }

  try {
    const settings = await getLinkExpirationSettings()
    return NextResponse.json(settings)
  } catch (error) {
    console.error("API: Erro ao ler configurações de expiração:", error)
    return NextResponse.json(
      {
        error: "Erro ao ler configurações",
        message: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies()
    const cookieToken = cookieStore.get("auth_token")?.value
    await requireAuth(request, cookieToken)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token não fornecido"
    return authErrorResponse(msg, 401)
  }

  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 })
    }

    const current = await getLinkExpirationSettings()

    let nextEnabled = current.enabled
    if (body.enabled !== undefined) {
      if (typeof body.enabled !== "boolean") {
        return NextResponse.json({ error: "enabled deve ser boolean" }, { status: 400 })
      }
      nextEnabled = body.enabled
    }

    let nextMinutes = current.minutes
    if (body.minutes !== undefined) {
      const parsed = Number(body.minutes)
      if (
        !Number.isInteger(parsed) ||
        parsed < LINK_EXPIRATION_MIN_MINUTES ||
        parsed > LINK_EXPIRATION_MAX_MINUTES
      ) {
        return NextResponse.json(
          {
            error: `minutes deve ser um inteiro entre ${LINK_EXPIRATION_MIN_MINUTES} e ${LINK_EXPIRATION_MAX_MINUTES}`,
          },
          { status: 400 },
        )
      }
      nextMinutes = parsed
    }

    let nextMessage = current.message
    if (body.message !== undefined) {
      if (typeof body.message !== "string") {
        return NextResponse.json({ error: "message deve ser string" }, { status: 400 })
      }
      if (body.message.length > LINK_EXPIRATION_MAX_MESSAGE_LENGTH) {
        return NextResponse.json(
          { error: `Mensagem muito longa (máx. ${LINK_EXPIRATION_MAX_MESSAGE_LENGTH})` },
          { status: 400 },
        )
      }
      nextMessage = body.message.trim() || LINK_EXPIRATION_DEFAULT_MESSAGE
    }

    if (nextEnabled && (!Number.isInteger(nextMinutes) || nextMinutes < LINK_EXPIRATION_MIN_MINUTES)) {
      return NextResponse.json(
        { error: "Informe um tempo de expiração válido ao ativar a expiração" },
        { status: 400 },
      )
    }

    await Promise.all([
      upsertAppSetting(LINK_EXPIRATION_KEY_ENABLED, nextEnabled ? "true" : "false"),
      upsertAppSetting(LINK_EXPIRATION_KEY_MINUTES, String(nextMinutes)),
      upsertAppSetting(LINK_EXPIRATION_KEY_MESSAGE, nextMessage),
    ])

    return NextResponse.json({
      enabled: nextEnabled,
      minutes: nextMinutes,
      message: nextMessage,
    })
  } catch (error) {
    console.error("API: Erro ao salvar configurações de expiração:", error)
    return NextResponse.json(
      {
        error: "Erro ao salvar configurações",
        message: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    )
  }
}
