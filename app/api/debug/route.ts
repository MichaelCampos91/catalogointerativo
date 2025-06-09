import { NextResponse } from "next/server"
import { testConnection, getDatabaseConfig } from "@/lib/database"

export async function GET() {
  try {
    console.log("API: Executando debug completo...")

    // Verificar configuração das variáveis de ambiente
    const config = getDatabaseConfig()

    // Testar conexão
    const isConnected = await testConnection()

    return NextResponse.json({
      status: isConnected ? "success" : "error",
      message: isConnected ? "Sistema funcionando corretamente" : "Problemas detectados",
      checks: {
        environment_variables: config,
        database_connection: isConnected ? "✅ Conectado" : "❌ Falha na conexão",
      },
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("API: Erro no debug:", error)
    return NextResponse.json(
      {
        status: "error",
        message: "Erro durante o debug",
        error: error instanceof Error ? error.message : "Erro desconhecido",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
