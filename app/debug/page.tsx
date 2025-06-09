"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, CheckCircle, XCircle, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"

type DebugInfo = {
  status: string
  message: string
  checks: {
    environment_variables: Record<string, string>
    database_connection: string
  }
  environment: {
    NODE_ENV: string
    NEXT_PUBLIC_APP_NAME: string
  }
  timestamp: string
}

export default function DebugPage() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/catalogointerativo"

  const loadDebugInfo = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`${basePath}/api/debug`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Erro ao carregar debug: ${errorData.message || response.status}`)
      }

      const data = await response.json()
      setDebugInfo(data)
    } catch (error) {
      console.error("Erro ao carregar debug:", error)
      setError(error instanceof Error ? error.message : "Erro desconhecido")
    } finally {
      setLoading(false)
    }
  }

  const initializeDatabase = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`${basePath}/api/init-db`, {
        method: "POST",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Erro ao inicializar banco: ${errorData.message || response.status}`)
      }

      const result = await response.json()
      console.log("Banco inicializado:", result)

      // Recarregar informações de debug
      await loadDebugInfo()
    } catch (error) {
      console.error("Erro ao inicializar banco:", error)
      setError(error instanceof Error ? error.message : "Erro desconhecido")
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDebugInfo()
  }, [])

  const getStatusIcon = (status: string) => {
    if (status.includes("✅")) {
      return <CheckCircle className="w-5 h-5 text-green-500" />
    }
    return <XCircle className="w-5 h-5 text-red-500" />
  }

  const getStatusBadge = (status: string) => {
    if (status.includes("✅")) {
      return <Badge className="bg-green-100 text-green-800">OK</Badge>
    }
    return <Badge variant="destructive">Erro</Badge>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Debug do Sistema</h1>
            <p className="text-gray-600">Diagnóstico completo da aplicação</p>
          </div>
          <Button variant="outline" onClick={() => router.push(`${basePath}/`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Início
          </Button>
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p>Executando diagnóstico...</p>
          </div>
        )}

        {error && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <XCircle className="w-6 h-6 text-red-500" />
                <h3 className="text-lg font-semibold text-red-700">Erro no Diagnóstico</h3>
              </div>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={loadDebugInfo}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Tentar Novamente
              </Button>
            </CardContent>
          </Card>
        )}

        {debugInfo && (
          <div className="space-y-6">
            {/* Status Geral */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  {debugInfo.status === "success" ? (
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-500" />
                  )}
                  Status Geral
                </CardTitle>
                <CardDescription>{debugInfo.message}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span>Sistema</span>
                  {debugInfo.status === "success" ? (
                    <Badge className="bg-green-100 text-green-800">Funcionando</Badge>
                  ) : (
                    <Badge variant="destructive">Com Problemas</Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Variáveis de Ambiente */}
            <Card>
              <CardHeader>
                <CardTitle>Variáveis de Ambiente</CardTitle>
                <CardDescription>Configuração das variáveis necessárias</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(debugInfo.checks.environment_variables).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(value)}
                        <span className="font-mono text-sm">{key}</span>
                      </div>
                      {getStatusBadge(value)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Conexão com Banco */}
            <Card>
              <CardHeader>
                <CardTitle>Conexão com Banco de Dados</CardTitle>
                <CardDescription>Status da conexão PostgreSQL</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(debugInfo.checks.database_connection)}
                    <span>Conexão PostgreSQL</span>
                  </div>
                  {getStatusBadge(debugInfo.checks.database_connection)}
                </div>
              </CardContent>
            </Card>

            {/* Ambiente */}
            <Card>
              <CardHeader>
                <CardTitle>Informações do Ambiente</CardTitle>
                <CardDescription>Configurações do Next.js</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span>NODE_ENV</span>
                    <Badge variant="outline">{debugInfo.environment.NODE_ENV}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>App Name</span>
                    <Badge variant="outline">{debugInfo.environment.NEXT_PUBLIC_APP_NAME}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Timestamp</span>
                    <Badge variant="outline">{new Date(debugInfo.timestamp).toLocaleString("pt-BR")}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ações */}
            <Card>
              <CardHeader>
                <CardTitle>Ações de Manutenção</CardTitle>
                <CardDescription>Ferramentas para resolver problemas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <Button onClick={loadDebugInfo} variant="outline">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Atualizar Diagnóstico
                  </Button>
                  <Button onClick={initializeDatabase} variant="secondary">
                    Inicializar Banco de Dados
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
