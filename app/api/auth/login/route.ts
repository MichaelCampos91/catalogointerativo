import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { generateToken } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { password } = body

    const adminPassword =
      process.env.ADMIN_PASSWORD || process.env.NEXT_PUBLIC_ADMIN_PASSWORD || ""

    if (!adminPassword) {
      return NextResponse.json(
        { error: "Configuração de senha ausente no servidor" },
        { status: 500 }
      )
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Senha é obrigatória" },
        { status: 400 }
      )
    }

    if (password !== adminPassword) {
      return NextResponse.json(
        { error: "Credenciais inválidas" },
        { status: 401 }
      )
    }

    const token = await generateToken({ sub: "admin" })
    const cookieStore = await cookies()
    cookieStore.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[auth/login]", err)
    return NextResponse.json(
      { error: "Erro ao processar login" },
      { status: 500 }
    )
  }
}
