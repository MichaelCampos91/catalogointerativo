import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getAppSettingBoolean, upsertAppSetting } from "@/lib/database"
import { requireAuth, authErrorResponse } from "@/lib/auth"

const KEY_RESTRICTED = "catalog_access_restricted"
const KEY_AUTO_REGISTER = "auto_register_links_on_confirm"

const DEFAULT_RESTRICTED = true
const DEFAULT_AUTO_REGISTER = false

type AccessSettings = {
  catalog_access_restricted: boolean
  auto_register_links_on_confirm: boolean
}

async function readSettings(): Promise<AccessSettings> {
  const [restricted, autoRegister] = await Promise.all([
    getAppSettingBoolean(KEY_RESTRICTED, DEFAULT_RESTRICTED),
    getAppSettingBoolean(KEY_AUTO_REGISTER, DEFAULT_AUTO_REGISTER),
  ])
  return {
    catalog_access_restricted: restricted,
    // Coerência: se a restrição está ligada, auto-registro não tem efeito.
    auto_register_links_on_confirm: restricted ? false : autoRegister,
  }
}

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
    const settings = await readSettings()
    return NextResponse.json(settings)
  } catch (error) {
    console.error("API: Erro ao ler configurações de acesso:", error)
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

    const current = await readSettings()

    const incomingRestricted = body.catalog_access_restricted
    const incomingAuto = body.auto_register_links_on_confirm

    let nextRestricted = current.catalog_access_restricted
    if (incomingRestricted !== undefined) {
      if (typeof incomingRestricted !== "boolean") {
        return NextResponse.json(
          { error: "catalog_access_restricted deve ser boolean" },
          { status: 400 },
        )
      }
      nextRestricted = incomingRestricted
    }

    let nextAuto = current.auto_register_links_on_confirm
    if (incomingAuto !== undefined) {
      if (typeof incomingAuto !== "boolean") {
        return NextResponse.json(
          { error: "auto_register_links_on_confirm deve ser boolean" },
          { status: 400 },
        )
      }
      nextAuto = incomingAuto
    }

    // Regra defensiva: a opção extra só faz sentido com restrição desligada.
    if (nextRestricted) {
      nextAuto = false
    }

    await Promise.all([
      upsertAppSetting(KEY_RESTRICTED, nextRestricted ? "true" : "false"),
      upsertAppSetting(KEY_AUTO_REGISTER, nextAuto ? "true" : "false"),
    ])

    return NextResponse.json({
      catalog_access_restricted: nextRestricted,
      auto_register_links_on_confirm: nextAuto,
    })
  } catch (error) {
    console.error("API: Erro ao salvar configurações de acesso:", error)
    return NextResponse.json(
      {
        error: "Erro ao salvar configurações",
        message: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    )
  }
}
