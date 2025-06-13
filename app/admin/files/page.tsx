"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { ArrowLeft, Folder, FileIcon, RefreshCw, Home } from "lucide-react"

type FileItem = {
  name: string
  path: string
  isDirectory: boolean
  url: string | null
}

type FilesResponse = {
  currentPath: string
  items: FileItem[]
}

export default function FilesPage() {
  const [files, setFiles] = useState<FilesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/catalogointerativo"

  // Senha simples para demo (em produção, use autenticação adequada)
  const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin123"

  // Obter o diretório atual da URL
  const currentDir = searchParams.get("dir") || ""

  useEffect(() => {
    if (isAuthenticated) {
      loadFiles()
    }
  }, [isAuthenticated, currentDir])

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
    } else {
      alert("Senha incorreta!")
    }
  }

  const loadFiles = async () => {
    try {
      setLoading(true)
      setError(null)

      // Remover "files" do início do caminho se existir
      const cleanDir = currentDir.startsWith("files/") ? currentDir.slice(6) : currentDir
      const response = await fetch(`/api/files?dir=${encodeURIComponent(cleanDir)}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Erro ao carregar arquivos: ${errorData.message || response.status}`)
      }

      const data = await response.json()
      setFiles(data)
    } catch (error) {
      console.error("Erro ao carregar arquivos:", error)
      setError(error instanceof Error ? error.message : "Erro desconhecido")
    } finally {
      setLoading(false)
    }
  }

  const navigateTo = (path: string) => {
    router.push(`/admin/files?dir=${encodeURIComponent(path)}`)
  }

  const navigateUp = () => {
    if (!currentDir) return

    const parts = currentDir.split("/")
    parts.pop()
    const parentDir = parts.join("/")
    navigateTo(parentDir)
  }

  const getBreadcrumbs = () => {
    if (!currentDir) return [{ name: "Files", path: "" }]

    const parts = currentDir.split("/")
    const breadcrumbs = [{ name: "Files", path: "" }]

    let currentPath = ""
    for (const part of parts) {
      if (!part) continue
      currentPath = currentPath ? `${currentPath}/${part}` : part
      breadcrumbs.push({ name: part, path: currentPath })
    }

    return breadcrumbs
  }

  // Renderizar login se não estiver autenticado
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Área Administrativa - Arquivos</CardTitle>
            <CardDescription>Digite a senha para acessar o gerenciador de arquivos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Senha
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="w-full px-3 py-2 border rounded-md"
                placeholder={`Senha padrão: ${ADMIN_PASSWORD}`}
              />
            </div>
            <Button onClick={handleLogin} className="w-full bg-primary text-primary-foreground">
              Entrar
            </Button>
            <Button variant="outline" onClick={() => router.push("/admin")} className="w-full bg-primary text-primary-foreground">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Painel
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gerenciador de Arquivos</h1>
            <p className="text-gray-600">Navegue pelos arquivos e pastas do catálogo</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadFiles}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
            <Button className="bg-primary text-primary-foreground" variant="outline" onClick={() => router.push("/admin")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Painel
            </Button>
          </div>
        </div>

        {/* Breadcrumbs */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <Breadcrumb>
              <BreadcrumbList>
                {getBreadcrumbs().map((crumb, index) => (
                  <div key={crumb.path} className="flex items-center">
                    {index > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      <BreadcrumbLink onClick={() => navigateTo(crumb.path)} className="cursor-pointer hover:underline">
                        {index === 0 ? (
                          <span className="flex items-center">
                            <Home className="w-4 h-4 mr-1" />
                            {crumb.name}
                          </span>
                        ) : (
                          crumb.name
                        )}
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                  </div>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </CardContent>
        </Card>

        {/* Loading state */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p>Carregando arquivos...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <Card className="mb-6">
            <CardContent className="p-6 text-center">
              <div className="text-red-500 mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12 mx-auto"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2">Erro ao Carregar Arquivos</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={loadFiles}>Tentar Novamente</Button>
            </CardContent>
          </Card>
        )}

        {/* Files and folders */}
        {files && !loading && !error && (
          <Card>
            <CardHeader>
              <CardTitle>{currentDir ? `Conteúdo de: ${currentDir}` : "Conteúdo da Pasta Raiz"}</CardTitle>
              <CardDescription>{files.items.length} item(s) encontrado(s)</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Parent directory button */}
              {currentDir && (
                <Button variant="outline" onClick={navigateUp} className="mb-4">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Pasta Superior
                </Button>
              )}

              {/* Files and folders grid */}
              {files.items.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Pasta vazia</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {files.items.map((item) => (
                    <div
                      key={item.path}
                      className={`
                        border rounded-lg overflow-hidden hover:shadow-md transition-shadow
                        ${item.isDirectory ? "bg-blue-50" : "bg-white"}
                      `}
                      onClick={() => item.isDirectory && navigateTo(item.path)}
                    >
                      {item.isDirectory ? (
                        <div className="p-4 text-center cursor-pointer">
                          <Folder className="w-16 h-16 mx-auto text-blue-500 mb-2" />
                          <p className="text-sm font-medium truncate">{item.name}</p>
                        </div>
                      ) : item.url && item.url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <div className="flex flex-col h-full">
                          <div className="relative aspect-square">
                            <img src={item.url || "/placeholder.svg"} alt={item.name} className="object-cover" />
                          </div>
                          <div className="p-2 text-center">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 text-center">
                          <FileIcon className="w-16 h-16 mx-auto text-gray-400 mb-2" />
                          <p className="text-sm font-medium truncate">{item.name}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
