import { NextResponse } from "next/server"
import { testConnection } from "@/lib/database"

export async function GET() {
  try {
    console.log("API: Testando conexão com o banco...")
    const isConnected = await testConnection()

    if (isConnected) {
      console.log("API: Conexão com o banco bem-sucedida")
      return NextResponse.json({
        status: "success",
        message: "Conexão com o banco estabelecida com sucesso!",
        timestamp: new Date().toISOString(),
      })
    } else {
      console.log("API: Falha na conexão com o banco")
      return NextResponse.json(
        {
          status: "error",
          message: "Falha na conexão com o banco de dados",
          timestamp: new Date().toISOString(),
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("API: Erro ao testar conexão:", error)
    return NextResponse.json(
      {
        status: "error",
        message: "Erro ao testar conexão",
        error: error instanceof Error ? error.message : "Erro desconhecido",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
