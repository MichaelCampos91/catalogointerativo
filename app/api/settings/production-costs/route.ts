import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import {
  DEFAULT_PRODUCTION_COSTS,
  getProductionCosts,
  upsertProductionCosts,
} from "@/lib/database"
import { requireAuth, authErrorResponse } from "@/lib/auth"

async function authOr401(request: Request) {
  try {
    const cookieStore = await cookies()
    const cookieToken = cookieStore.get("auth_token")?.value
    await requireAuth(request, cookieToken)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token não fornecido"
    return authErrorResponse(msg, 401)
  }
  return null
}

function parseMoneyField(value: unknown, label: string): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".")
    if (normalized === "") return 0
    const n = Number(normalized)
    if (Number.isFinite(n)) return n
  }
  return null
}

export async function GET(request: Request) {
  const authError = await authOr401(request)
  if (authError) return authError

  try {
    const costs = await getProductionCosts()
    return NextResponse.json({ costs })
  } catch (error) {
    console.error("API: Erro ao ler custos de produção:", error)
    return NextResponse.json(
      {
        error: "Erro ao ler custos",
        message: error instanceof Error ? error.message : "Erro desconhecido",
        costs: DEFAULT_PRODUCTION_COSTS,
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  const authError = await authOr401(request)
  if (authError) return authError

  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 })
    }

    const cutSewPerItem = parseMoneyField(body.cutSewPerItem, "Corte e costura")
    const fabricPerMeter = parseMoneyField(body.fabricPerMeter, "Tecido sublimado")
    const packagingPerOrder = parseMoneyField(body.packagingPerOrder, "Embalagem")

    if (cutSewPerItem === null || fabricPerMeter === null || packagingPerOrder === null) {
      return NextResponse.json(
        { error: "Informe valores numéricos válidos para todos os custos" },
        { status: 400 }
      )
    }

    const costs = await upsertProductionCosts({
      cutSewPerItem,
      fabricPerMeter,
      packagingPerOrder,
    })
    return NextResponse.json({ costs })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    const isValidation = message.includes("deve ser")
    console.error("API: Erro ao salvar custos de produção:", error)
    return NextResponse.json(
      { error: isValidation ? message : "Erro ao salvar custos", message },
      { status: isValidation ? 400 : 500 }
    )
  }
}
