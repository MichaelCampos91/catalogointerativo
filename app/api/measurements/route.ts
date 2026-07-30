import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createMeasurement, getMeasurements } from "@/lib/database"
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

export async function GET(request: Request) {
  const authError = await authOr401(request)
  if (authError) return authError

  try {
    const measurements = await getMeasurements()
    return NextResponse.json({ measurements })
  } catch (error) {
    console.error("API: Erro ao listar medidas:", error)
    return NextResponse.json(
      {
        error: "Erro ao listar medidas",
        message: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const authError = await authOr401(request)
  if (authError) return authError

  try {
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

    const measurement = await createMeasurement({ quantity, meters, observation })
    return NextResponse.json({ measurement }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    const isConflict = message.includes("Já existe")
    const isValidation =
      message.includes("deve ser") || message.includes("muito longa") || message.includes("maior")
    console.error("API: Erro ao criar medida:", error)
    return NextResponse.json(
      { error: isConflict || isValidation ? message : "Erro ao criar medida", message },
      { status: isConflict ? 409 : isValidation ? 400 : 500 }
    )
  }
}
