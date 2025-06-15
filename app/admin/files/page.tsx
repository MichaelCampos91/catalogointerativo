"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { ArrowLeft, Folder, FileIcon, RefreshCw, Home, Plus, Upload, Trash2, ImagePlus, FolderPlus } from "lucide-react"

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
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedFolder, setSelectedFolder] = useState<FileItem | null>(null)
  const [deleteSuccess, setDeleteSuccess] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  const handleCreateFolder = async () => {
    try {
      setLoading(true)
      const formData = new FormData()
      formData.append("action", "createFolder")
      // Garantir que sempre enviamos um diretório, mesmo que vazio
      formData.append("dir", currentDir || "")
      formData.append("folderName", newFolderName)

      console.log("Frontend: Enviando requisição para criar pasta", {
        action: "createFolder",
        dir: currentDir || "",
        folderName: newFolderName
      })

      const response = await fetch("/api/files", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()
      console.log("Frontend: Resposta do servidor", { status: response.status, data })

      if (!response.ok) {
        throw new Error(data.message || data.error || "Erro ao criar pasta")
      }

      toast({
        title: "Sucesso",
        description: "Pasta criada com sucesso",
      })
      setShowCreateFolder(false)
      setNewFolderName("")
      loadFiles()
    } catch (error) {
      console.error("Frontend: Erro ao criar pasta", error)
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao criar pasta",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteItem = async (item: FileItem) => {
    try {
      setIsDeleting(true)
      setDeleteSuccess(false)
      const params = new URLSearchParams({
        dir: currentDir || "",
        path: item.name
      })

      console.log("Frontend: Enviando requisição para excluir item", {
        dir: currentDir || "",
        path: item.name,
        isDirectory: item.isDirectory
      })

      const response = await fetch(`/api/files?${params.toString()}`, {
        method: "DELETE"
      })

      const data = await response.json()
      console.log("Frontend: Resposta do servidor", { status: response.status, data })

      if (!response.ok) {
        throw new Error(data.message || data.error || `Erro ao excluir ${item.isDirectory ? 'pasta' : 'arquivo'}`)
      }

      setDeleteSuccess(true)
      toast({
        title: "Sucesso",
        description: `${item.isDirectory ? 'Diretório' : 'Arquivo'} excluído com sucesso!`,
      })
      loadFiles()
    } catch (error) {
      console.error("Frontend: Erro ao excluir item", error)
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : `Erro ao excluir ${item.isDirectory ? 'pasta' : 'arquivo'}`,
        variant: "destructive",
      })
      setShowDeleteConfirm(false)
      setSelectedFolder(null)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCloseDeleteModal = () => {
    setShowDeleteConfirm(false)
    setSelectedFolder(null)
    setDeleteSuccess(false)
    setIsDeleting(false)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    try {
      setLoading(true)
      const formData = new FormData()
      formData.append("action", "upload")
      formData.append("dir", currentDir)
      formData.append("file", files[0])

      const response = await fetch("/api/files", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Erro ao fazer upload do arquivo")
      }

      toast({
        title: "Sucesso",
        description: "Arquivo enviado com sucesso",
      })
      loadFiles()
    } catch (error) {
      console.error("Erro ao fazer upload:", error)
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao fazer upload do arquivo",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const filteredFiles = useMemo(() => {
    if (!files?.items) return []
    
    return files.items.filter(item => {
      const searchLower = searchQuery.toLowerCase()
      return item.name.toLowerCase().includes(searchLower)
    })
  }, [files?.items, searchQuery])

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
                placeholder={`Digite a senha`}
              />
            </div>
            <Button onClick={handleLogin} className="w-full bg-primary text-primary-foreground">
              Entrar
            </Button>
            <Button variant="ghost" onClick={() => router.push("/admin")} className="w-full text-primary">
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
            <p className="text-gray-600">Gerencie os arquivos do catálogo</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <ImagePlus className="w-4 h-4 mr-2" />
              Add Imagem
            </Button>
            <Button variant="outline" onClick={() => setShowCreateFolder(true)}>
              <FolderPlus className="w-4 h-4 mr-2" />
              Add Pasta
            </Button>
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

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
        />

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

        <div className="relative mb-6 w-full">
          <input
            type="text"
            placeholder="Buscar pasta..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg
            className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

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
                  {filteredFiles.map((item) => (
                    <div
                      key={item.path}
                      className={`
                        border rounded-lg overflow-hidden hover:shadow-md transition-shadow
                        ${item.isDirectory ? "bg-blue-50" : "bg-white"}
                      `}
                    >
                      {item.isDirectory ? (
                        <div className="p-4 text-center">
                          <div
                            className="cursor-pointer"
                            onClick={() => navigateTo(item.path)}
                          >
                            <Folder className="w-16 h-16 mx-auto text-blue-500 mb-2" />
                            <p className="text-sm font-medium truncate">{item.name}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedFolder(item)
                              setShowDeleteConfirm(true)
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : item.url && item.url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <div className="flex flex-col h-full">
                          <div className="relative aspect-square">
                            <img src={item.url || "/placeholder.svg"} alt={item.name} className="object-cover" />
                          </div>
                          <div className="p-2 text-center">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-1 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                setSelectedFolder(item)
                                setShowDeleteConfirm(true)
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 text-center">
                          <FileIcon className="w-16 h-16 mx-auto text-gray-400 mb-2" />
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setSelectedFolder(item)
                              setShowDeleteConfirm(true)
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Create Folder Dialog */}
        <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Pasta</DialogTitle>
              <DialogDescription>
                Digite o nome da nova pasta que deseja criar
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="folderName">Nome da Pasta</Label>
              <Input
                id="folderName"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Digite o nome da pasta"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateFolder(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                Criar Pasta
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteConfirm} onOpenChange={handleCloseDeleteModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {deleteSuccess 
                  ? "Exclusão Concluída" 
                  : `Excluir ${selectedFolder?.isDirectory ? 'Pasta' : 'Arquivo'}`
                }
              </DialogTitle>
              <DialogDescription>
                {deleteSuccess ? (
                  <div className="text-center py-4">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg
                        className="w-6 h-6 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <p className="text-green-600 font-medium">
                      {selectedFolder?.isDirectory ? 'Pasta' : 'Arquivo'} excluído com sucesso!
                    </p>
                  </div>
                ) : (
                  <>
                    Tem certeza que deseja excluir {selectedFolder?.isDirectory ? 'a pasta' : 'o arquivo'} "{selectedFolder?.name}"?
                    {selectedFolder?.isDirectory && " Todos os arquivos dentro dela serão excluídos."}
                    Esta ação não pode ser desfeita.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              {deleteSuccess ? (
                <Button onClick={handleCloseDeleteModal}>
                  Fechar
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={handleCloseDeleteModal}>
                    Cancelar
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => selectedFolder && handleDeleteItem(selectedFolder)}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Excluindo...
                      </>
                    ) : (
                      "Excluir"
                    )}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
