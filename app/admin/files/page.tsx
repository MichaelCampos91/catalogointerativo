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
import { ArrowLeft, Folder, FileIcon, RefreshCw, Home, Plus, Upload, Trash2, ImagePlus, FolderPlus, Pencil } from "lucide-react"

type Category = {
  id: string
  name: string
  slug: string
  images: {
    name: string
    code: string
    url: string
    category: string
  }[]
}

type FilesResponse = {
  categories: Category[]
  images?: {
    name: string
    code: string
    url: string
    category: string
  }[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export default function FilesPage() {
  const [files, setFiles] = useState<FilesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedFolder, setSelectedFolder] = useState<Category | null>(null)
  const [deleteSuccess, setDeleteSuccess] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [folderToRename, setFolderToRename] = useState<Category | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameSuccess, setRenameSuccess] = useState<boolean | null>(null)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/catalogointerativo"

  const currentDir = searchParams.get("dir") || ""

  useEffect(() => {
    loadFiles()
  }, [currentDir])

  const loadFiles = async (forceReload: boolean = false) => {
    try {
      // console.log('📂 [Frontend] Iniciando carregamento de arquivos...', { currentDir, forceReload })
      setLoading(true)
      setError(null)

      // Remover "files" do início do caminho se existir
      const cleanDir = currentDir.startsWith("files/") ? currentDir.slice(6) : currentDir
      let url = `/api/files?dir=${encodeURIComponent(cleanDir)}&all=true`
      
      // Adicionar timestamp para cache-busting se forceReload for true
      if (forceReload) {
        url += `&_t=${Date.now()}`
        // console.log('🔄 [Frontend] Forçando bypass do cache do navegador')
      }
      
      // console.log('📤 [Frontend] Fazendo requisição:', { url, cleanDir, currentDir, forceReload })
      const startTime = Date.now()
      
      // Usar cache: 'no-store' se forceReload for true para forçar bypass do cache do navegador
      const fetchOptions: RequestInit = forceReload 
        ? { 
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          }
        : {}
      
      const response = await fetch(url, fetchOptions)

      const elapsedTime = Date.now() - startTime
      // console.log(`⏱️ [Frontend] Resposta recebida em ${elapsedTime}ms:`, {
      //   status: response.status,
      //   statusText: response.statusText,
      //   ok: response.ok,
      //   headers: Object.fromEntries(response.headers.entries())
      // })

      if (!response.ok) {
        const errorData = await response.json()
        // console.error('❌ [Frontend] Erro na resposta:', {
        //   status: response.status,
        //   statusText: response.statusText,
        //   errorData
        // })
        throw new Error(`Erro ao carregar arquivos: ${errorData.message || response.status}`)
      }

      const data = await response.json()
      // console.log('✅ [Frontend] Dados recebidos com sucesso:', {
      //   categoriesCount: data.categories?.length || 0,
      //   imagesCount: data.images?.length || 0,
      //   pagination: data.pagination,
      //   sampleCategories: data.categories?.slice(0, 3).map((c: Category) => ({ name: c.name, imagesCount: c.images?.length || 0 })),
      //   sampleImages: data.images?.slice(0, 3).map((img: any) => ({ name: img.name, url: img.url?.substring(0, 50) + '...' }))
      // })
      setFiles(data)
    } catch (error) {
      // console.error("❌ [Frontend] Erro ao carregar arquivos:", {
      //   error,
      //   message: error instanceof Error ? error.message : "Erro desconhecido",
      //   stack: error instanceof Error ? error.stack : undefined,
      //   currentDir
      // })
      setError(error instanceof Error ? error.message : "Erro desconhecido")
    } finally {
      setLoading(false)
      // console.log('🏁 [Frontend] Carregamento de arquivos finalizado')
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

      const response = await fetch("/api/files", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || "Erro ao criar pasta")
      }

      toast({
        title: "Sucesso",
        description: "Pasta criada com sucesso",
      })
      setShowCreateFolder(false)
      setNewFolderName("")
      loadFiles(true) // Forçar bypass do cache após criar pasta
    } catch (error) {
      // console.error("Frontend: Erro ao criar pasta", error)
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao criar pasta",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Corrigir handleDeleteItem e modais para Category
  const handleDeleteItem = async (cat: Category) => {
    try {
      setIsDeleting(true)
      setDeleteSuccess(false)
      const params = new URLSearchParams({
        dir: currentDir || "",
        path: cat.name
      })
      const response = await fetch(`/api/files?${params.toString()}`, {
        method: "DELETE"
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || data.error || `Erro ao excluir pasta`)
      }
      setDeleteSuccess(true)
      toast({
        title: "Sucesso",
        description: `Pasta excluída com sucesso!`,
      })
      loadFiles(true) // Forçar bypass do cache após excluir pasta
    } catch (error) {
      // console.error("Frontend: Erro ao excluir categoria", error)
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : `Erro ao excluir pasta`,
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

  const handleOpenRename = (cat: Category) => {
    setFolderToRename(cat)
    setRenameValue(cat.name)
    setRenameSuccess(null)
    setRenameError(null)
    setShowRenameDialog(true)
  }

  const handleCloseRename = () => {
    setShowRenameDialog(false)
    setFolderToRename(null)
    setRenameValue("")
    setRenameSuccess(null)
    setRenameError(null)
    setIsRenaming(false)
  }

  const handleRenameFolder = async () => {
    if (!folderToRename || !renameValue.trim()) return
    const newName = renameValue.trim()
    if (newName === folderToRename.name) return
    setIsRenaming(true)
    setRenameError(null)
    setRenameSuccess(null)
    try {
      const formData = new FormData()
      formData.append("action", "renameFolder")
      const cleanDir = currentDir.startsWith("files/") ? currentDir.slice(6) : currentDir
      formData.append("dir", cleanDir || "")
      formData.append("oldName", folderToRename.name)
      formData.append("newName", newName)
      const response = await fetch("/api/files", { method: "POST", body: formData })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || data.message || "Erro ao renomear pasta")
      }
      setRenameSuccess(true)
      loadFiles(true)
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : "Erro ao renomear pasta")
    } finally {
      setIsRenaming(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) {
      // console.log('⚠️ [Frontend] Nenhum arquivo selecionado')
      return
    }

    const file = files[0]
    // console.log('📤 [Frontend] Iniciando upload de arquivo:', {
    //   name: file.name,
    //   size: file.size,
    //   type: file.type,
    //   lastModified: new Date(file.lastModified).toISOString(),
    //   currentDir
    // })

    try {
      setLoading(true)
      const formData = new FormData()
      formData.append("action", "upload")
      // Remover "files/" do início do caminho se existir
      const cleanDir = currentDir.startsWith("files/") ? currentDir.slice(6) : currentDir
      formData.append("dir", cleanDir)
      formData.append("file", file)

      // console.log('📋 [Frontend] FormData preparado:', {
      //   action: "upload",
      //   dir: cleanDir,
      //   fileName: file.name,
      //   fileSize: file.size,
      //   fileType: file.type
      // })

      const startTime = Date.now()
      const response = await fetch("/api/files", {
        method: "POST",
        body: formData,
      })

      const elapsedTime = Date.now() - startTime
      // console.log(`⏱️ [Frontend] Resposta do upload recebida em ${elapsedTime}ms:`, {
      //   status: response.status,
      //   statusText: response.statusText,
      //   ok: response.ok,
      //   headers: Object.fromEntries(response.headers.entries())
      // })

      if (!response.ok) {
        let errorData
        try {
          errorData = await response.json()
        } catch (e) {
          const text = await response.text()
          errorData = { message: text || `Erro HTTP ${response.status}` }
        }
        // console.error('❌ [Frontend] Erro no upload:', {
        //   status: response.status,
        //   statusText: response.statusText,
        //   errorData,
        //   fileName: file.name
        // })
        throw new Error(errorData.message || errorData.error || "Erro ao fazer upload do arquivo")
      }

      const data = await response.json()
      // console.log('✅ [Frontend] Upload concluído com sucesso:', {
      //   data,
      //   fileName: file.name,
      //   totalTime: elapsedTime
      // })

      toast({
        title: "Sucesso",
        description: "Arquivo enviado com sucesso",
      })
      loadFiles(true) // Forçar bypass do cache após upload
    } catch (error) {
      // console.error("❌ [Frontend] Erro ao fazer upload:", {
      //   error,
      //   message: error instanceof Error ? error.message : "Erro desconhecido",
      //   stack: error instanceof Error ? error.stack : undefined,
      //   fileName: file.name,
      //   fileSize: file.size,
      //   fileType: file.type,
      //   currentDir
      // })
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
      // console.log('🏁 [Frontend] Processo de upload finalizado')
    }
  }

  const filteredCategories = useMemo(() => {
    if (!files?.categories) return []
    
    return files.categories.filter(cat => {
      const searchLower = searchQuery.toLowerCase()
      return cat.name.toLowerCase().includes(searchLower)
    })
  }, [files?.categories, searchQuery])

  // Adicionar função para deletar imagem individual
  const handleDeleteImage = async (img: { name: string; code: string; url: string; category: string }) => {
    if (!window.confirm(`Tem certeza que deseja excluir a imagem "${img.name}"?`)) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({
        dir: currentDir || "",
        path: img.name
      });
      const response = await fetch(`/api/files?${params.toString()}`, {
        method: "DELETE"
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error || `Erro ao excluir imagem`);
      }
      toast({
        title: "Sucesso",
        description: `Imagem excluída com sucesso!`
      });
      loadFiles(true); // Forçar bypass do cache após excluir imagem
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : `Erro ao excluir imagem`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

  return (
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
            <Button variant="outline" onClick={() => loadFiles()}>
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
          accept="image/*"
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
              <Button onClick={() => loadFiles()}>Tentar Novamente</Button>
            </CardContent>
          </Card>
        )}

        {/* Files and folders */}
        {files && !loading && !error && (
          <Card>
            <CardHeader>
              <CardTitle>{currentDir ? `Conteúdo de: ${currentDir}` : "Conteúdo da Pasta Raiz"}</CardTitle>
              <CardDescription>{files.categories.length} pasta(s) encontrada(s)</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Parent directory button */}
              {currentDir && (
                <Button variant="outline" onClick={navigateUp} className="mb-4">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Pasta Superior
                </Button>
              )}
              {/* Grid de categorias */}
              {files.categories.length === 0 && files.images && files.images.length > 0 && currentDir.trim() !== "" ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {files.images.map((img) => (
                    <div key={img.code} className="border rounded-lg overflow-hidden bg-white flex flex-col items-center p-4 relative">
                      <img
                        src={img.url}
                        alt={img.name}
                        className="w-full h-32 object-cover rounded mb-2"
                      />
                      <p className="text-sm font-medium truncate w-full text-center">{img.name}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteImage(img)}
                        title="Excluir imagem"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : files.categories.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Pasta vazia</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {filteredCategories.map((cat) => (
                    <div
                      key={cat.id}
                      className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-blue-50"
                    >
                      <div className="p-4 text-center">
                        <div
                          className="cursor-pointer"
                          onClick={() => navigateTo(cat.name)}
                        >
                          <Folder className="w-16 h-16 mx-auto text-blue-500 mb-2" />
                          <p className="text-sm font-medium truncate">{cat.name}</p>
                        </div>
                        <div className="mt-2 flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenRename(cat)
                            }}
                            title="Renomear pasta"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedFolder(cat)
                              setShowDeleteConfirm(true)
                            }}
                            title="Excluir pasta"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
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

        {/* Rename Folder Dialog */}
        <Dialog open={showRenameDialog} onOpenChange={(open) => !open && handleCloseRename()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {renameSuccess === true ? "Pasta renomeada" : renameError ? "Erro ao renomear" : "Renomear Pasta"}
              </DialogTitle>
              <DialogDescription>
                {renameSuccess === true ? (
                  "A pasta foi renomeada com sucesso."
                ) : renameError ? (
                  <span className="text-destructive">{renameError}</span>
                ) : (
                  "Digite o novo nome da pasta. Você pode usar espaços, acentos e os caracteres que preferir."
                )}
              </DialogDescription>
            </DialogHeader>
            {renameSuccess !== true && !renameError && (
              <div className="py-4">
                <Label htmlFor="renameFolderName">Novo nome da pasta</Label>
                <Input
                  id="renameFolderName"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  placeholder="Novo nome da pasta"
                  disabled={isRenaming}
                />
              </div>
            )}
            <DialogFooter>
              {renameSuccess === true ? (
                <Button onClick={handleCloseRename}>Fechar</Button>
              ) : renameError ? (
                <>
                  <Button variant="outline" onClick={handleCloseRename}>
                    Fechar
                  </Button>
                  <Button onClick={() => { setRenameError(null); handleRenameFolder(); }}>
                    Tentar novamente
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={handleCloseRename} disabled={isRenaming}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleRenameFolder}
                    disabled={
                      isRenaming ||
                      !renameValue.trim() ||
                      renameValue.trim() === folderToRename?.name
                    }
                  >
                    {isRenaming ? (
                      <>
                        <span className="inline-block h-4 w-4 border-2 border-current border-r-transparent rounded-full animate-spin mr-2" />
                        Renomeando...
                      </>
                    ) : (
                      "Renomear"
                    )}
                  </Button>
                </>
              )}
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
                  : `Excluir Pasta`
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
                      Pasta excluída com sucesso!
                    </p>
                  </div>
                ) : (
                  <>
                    Tem certeza que deseja excluir a pasta "{selectedFolder?.name}"?
                    Todos os arquivos dentro dela serão excluídos. Esta ação não pode ser desfeita.
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
  )
}
