import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getAppSetting, upsertAppSetting } from "@/lib/database"
import { requireAuth, authErrorResponse } from "@/lib/auth"

const SETTING_KEY = "default_link_message"
const FALLBACK_TEMPLATE =
  "Olá! Aqui está o link para escolher os itens do seu pedido na nossa galeria: {{link}}"

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
    const value = await getAppSetting(SETTING_KEY)
    return NextResponse.json({ template: value ?? FALLBACK_TEMPLATE })
  } catch (error) {
    console.error("API: Erro ao ler template padrão:", error)
    return NextResponse.json(
      {
        error: "Erro ao ler template",
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
    if (!body || typeof body !== "object" || typeof body.template !== "string") {
      return NextResponse.json({ error: "Template inválido" }, { status: 400 })
    }
    const template = body.template
    if (template.length > 5000) {
      return NextResponse.json({ error: "Template muito longo (máx. 5000)" }, { status: 400 })
    }
    await upsertAppSetting(SETTING_KEY, template)
    return NextResponse.json({ template })
  } catch (error) {
    console.error("API: Erro ao salvar template padrão:", error)
    return NextResponse.json(
      {
        error: "Erro ao salvar template",
        message: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    )
  }
}
