import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { deleteMeasurement, updateMeasurement } from "@/lib/database"
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

type RouteContext = { params: Promise<{ id: string }> }

export async function PUT(request: Request, context: RouteContext) {
  const authError = await authOr401(request)
  if (authError) return authError

  try {
    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: "ID obrigatório" }, { status: 400 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 })
    }

    const quantity = Number(body.quantity)
    const meters = Number(body.meters)
    const observation = typeof body.observation === "string" ? body.observation : ""

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json({ error: "Quantidade deve ser um inteiro maior que zero" }, { status: 400 })
    }
    if (!Number.isFinite(meters) || meters < 0) {
      return NextResponse.json({ error: "Metros deve ser um número maior ou igual a zero" }, { status: 400 })
    }

    const measurement = await updateMeasurement(id, { quantity, meters, observation })
    return NextResponse.json({ measurement })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    if (message === "Medida não encontrada") {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    const isConflict = message.includes("Já existe")
    const isValidation =
      message.includes("deve ser") || message.includes("muito longa") || message.includes("maior")
    console.error("API: Erro ao atualizar medida:", error)
    return NextResponse.json(
      { error: isConflict || isValidation ? message : "Erro ao atualizar medida", message },
      { status: isConflict ? 409 : isValidation ? 400 : 500 }
    )
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const authError = await authOr401(request)
  if (authError) return authError

  try {
    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: "ID obrigatório" }, { status: 400 })
    }
    await deleteMeasurement(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    if (message === "Medida não encontrada") {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    console.error("API: Erro ao excluir medida:", error)
    return NextResponse.json(
      { error: "Erro ao excluir medida", message },
      { status: 500 }
    )
  }
}
