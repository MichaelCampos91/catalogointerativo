"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Download, Calendar, User, Package, ArrowLeft, AlertCircle, FolderOpen, Copy, Check, ChevronDown, Image, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-sonner-toast"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

type Order = {
  id: string
  customer_name: string
  quantity_purchased: number
  selected_images: string[]
  created_at: string
  updated_at: string
  order: string
  is_pending: boolean
}

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const router = useRouter()
  const toast = useToast()
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/catalogointerativo"
  const [downloadingOrder, setDownloadingOrder] = useState<string | null>(null)
  const [filterPending, setFilterPending] = useState<"all" | "pending" | "completed">("all")
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [selectedOrderToClose, setSelectedOrderToClose] = useState<Order | null>(null)

  // Usar variável de ambiente pública para a senha (em produção, use autenticação adequada)
  const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || ""

  useEffect(() => {
    if (isAuthenticated) {
      loadOrders()
    }
  }, [isAuthenticated])

  useEffect(() => {
    filterOrders()
  }, [orders, dateFilter, filterPending, searchQuery])

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
    } else {
      alert("Senha incorreta!")
    }
  }

  const loadOrders = async () => {
    try {
      setError(null)
      console.log("Carregando pedidos...")

      const response = await fetch("/api/orders")

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Erro ao carregar pedidos: ${errorData.message || response.status}`)
      }

      const data = await response.json()
      console.log(`${data.length} pedidos carregados`)
      setOrders(data || [])
      setFilteredOrders(data || [])
    } catch (error) {
      console.error("Erro ao carregar pedidos:", error)
      setError(error instanceof Error ? error.message : "Erro desconhecido")
    } finally {
      setLoading(false)
    }
  }

  const filterOrders = async () => {
    if (!dateFilter && filterPending === "all" && !searchQuery) {
      setFilteredOrders(orders)
      return
    }
  
    let filtered = orders
  
    if (dateFilter) {
      try {
        const response = await fetch(`/api/orders?date=${dateFilter}`)
        if (!response.ok) throw new Error("Erro ao filtrar por data")
        filtered = await response.json()
      } catch (error) {
        console.error("Erro ao filtrar por data:", error)
        setError(error instanceof Error ? error.message : "Erro desconhecido")
        return
      }
    }
  
    if (filterPending === "pending") {
      filtered = filtered.filter((order) => order.is_pending)
    } else if (filterPending === "completed") {
      filtered = filtered.filter((order) => !order.is_pending)
    }

    // Busca por nome do cliente ou número do pedido
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((order) => 
        order.customer_name.toLowerCase().includes(query) ||
        order.order.toLowerCase().includes(query)
      )
    }
  
    setFilteredOrders(filtered)
  }
  

  const initializeDatabase = async () => {
    try {
      setError(null)
      setLoading(true)

      console.log("Inicializando banco de dados...")
      const response = await fetch("/api/init-db", {
        method: "POST",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Erro ao inicializar banco de dados: ${errorData.message || response.status}`)
      }

      const result = await response.json()
      console.log("Banco inicializado:", result)

      // Recarregar dados após inicialização
      await loadOrders()
    } catch (error) {
      console.error("Erro ao inicializar banco:", error)
      setError(error instanceof Error ? error.message : "Erro desconhecido")
      setLoading(false)
    }
  }

  const downloadOrderFiles = async (order: Order) => {
    try {
      setDownloadingOrder(order.id)
      
      // Preparar download
      const response = await fetch("/api/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selectedImages: order.selected_images,
          customerName: order.customer_name,
          orderNumber: order.order,
          date: order.created_at
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Erro ao preparar download")
      }

      const data = await response.json()
      
      if (data.foundFiles === 0) {
        toast.error({
          title: "Nenhum arquivo encontrado",
          description: "Não foi possível encontrar os arquivos selecionados",
        })
        return
      }

      // Iniciar download
      window.location.href = data.zipPath
      
      toast.success({
        title: "Download iniciado",
        description: `${data.foundFiles} arquivos encontrados`,
      })
    } catch (error) {
      console.error("Erro ao fazer download:", error)
      toast.error({
        title: "Erro ao fazer download",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      })
    } finally {
      setDownloadingOrder(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("pt-BR")
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      console.log("Copiado - toast acionado")
      toast.success({
        title: "Copiado!",
        description: "Texto copiado para a área de transferência",
      })
    } catch (err) {
      console.error("Erro ao copiar:", err)
      toast.error({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o texto",
      })
    }
  }

  const copyAllImages = (images: string[]) => {
    const text = images.join("\n")
    copyToClipboard(text)
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Área Administrativa</CardTitle>
            <CardDescription>Digite a senha para acessar o painel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Senha Admin</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="Digite a senha"
              />
            </div>
            <Button onClick={handleLogin} className="w-full bg-primary text-primary-foreground">
              Entrar
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p>Carregando pedidos...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Erro ao Carregar Pedidos</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="space-y-2">
              <Button onClick={loadOrders} className="w-full">
                Tentar Novamente
              </Button>
              <Button onClick={initializeDatabase} variant="secondary" className="w-full">
                Inicializar Banco de Dados
              </Button>
              <Button variant="outline" onClick={() => router.push("/")} className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao Início
              </Button>
            </div>
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
            <h1 className="text-2xl font-bold text-gray-900">Painel Administrativo</h1>
            <p className="text-gray-600">Gerencie os pedidos do catálogo</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/admin/files")}>
              <FolderOpen className="w-4 h-4 mr-2" />
              Gerenciar Arquivos
            </Button>
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-2">
                {filterPending === "pending" ? "Somente Pendentes" : 
                 filterPending === "completed" ? "Somente Concluídos" : 
                 "Todos os Pedidos"}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilterPending("all")}>
                Todos os Pedidos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterPending("pending")}>
                Somente Pendentes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterPending("completed")}>
                Somente Concluídos
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>

        {/* Resumo das quantidades */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-2">Total de Pedidos</p>
                  <p className="text-xl font-bold">{filteredOrders.length}</p>
                </div>
                <Package className="w-8 h-8 text-indigo-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-2">Total de Clientes</p>
                  <p className="text-xl font-bold">
                    {new Set(filteredOrders.map(order => order.customer_name)).size}
                  </p>
                </div>
                <User className="w-8 h-8 text-indigo-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-2">Filtrar por Data</p>
                  <Input
                    className="text-xs"
                    id="date"
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => setDateFilter("")}
                  className="mt-6"
                >
                  Limpar Filtro
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Campo de busca */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="Buscar por nome do cliente ou número do pedido..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabela de pedidos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold">Lista de Pedidos</CardTitle>
            <CardDescription className="text-sm">
              {searchQuery 
                ? `${filteredOrders.length} pedido(s) encontrado(s) para "${searchQuery}"`
                : `${filteredOrders.length} pedido(s) encontrado(s)`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto overflow-y-auto max-h-[320px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="overflow-y-auto h-[300px]">
                  {filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4 text-gray-500">
                        Nenhum pedido encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{order.customer_name}</p>
                            <button
                              onClick={() => copyToClipboard(order.order)}
                              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                            >
                              <Copy className="w-3 h-3 mr-1" />
                              <span>{order.order}</span>
                            </button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-xs text-gray-700 mt-2">
                            <span className="font-medium text-gray-600">
                              🆕 Criado em:
                            </span>
                            <br/>
                            {formatDate(order.created_at)}
                          </p>
                          {!order.is_pending && (
                            <p className="text-xs text-gray-700 mt-2">
                              <span className="font-medium text-gray-600">
                                ✅ Concluído em:
                              </span>
                              <br/>
                              {formatDate(order.updated_at)}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{order.quantity_purchased} produtos</Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-[180px] max-h-[300px] overflow-y-auto">
                                <div className="p-2 flex items-center justify-between border-b">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2"
                                    onClick={() => copyAllImages(order.selected_images)}
                                  >
                                    <Copy className="h-4 w-4 mr-1" />
                                    Copiar Lista
                                  </Button>
                                </div>
                                {order.selected_images.map((code) => (
                                  <DropdownMenuItem
                                    key={code}
                                    className="flex items-center justify-between"
                                  >
                                    <span className="truncate">{code}</span>
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2"> 
                            <Button 
                              size="sm" 
                              onClick={() => downloadOrderFiles(order)}
                              disabled={downloadingOrder === order.id}
                              className="bg-primary text-primary-foreground"
                            >
                              <Download className="w-4 h-4" />
                              {downloadingOrder === order.id ? "Aguarde..." : "Baixar"}
                            </Button>
                            {order.is_pending && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="ml-2"
                                  onClick={() => {
                                    setSelectedOrderToClose(order)
                                    setConfirmDialogOpen(true)
                                  }}
                                >
                                  <Check className="w-4 h-4" />
                                  Concluir
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Concluir Pedido?</DialogTitle>
          </DialogHeader>
          <p>Tem certeza que deseja marcar este pedido como concluído?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!selectedOrderToClose) return
                try {
                  const response = await fetch("/api/orders", {
                    method: "PATCH",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ id: selectedOrderToClose.id }),
                  })
      
                  if (!response.ok) throw new Error("Erro ao concluir pedido")
      
                  const updated = await response.json()
      
                  setOrders((prev) =>
                    prev.map((order) =>
                      order.id === updated.id ? updated : order
                    )
                  )
      
                  toast.success({
                    title: "Pedido concluído",
                    description: "O pedido foi marcado como concluído",
                  })
                } catch (err) {
                  toast.error({
                    title: "Erro",
                    description: "Não foi possível concluir o pedido",
                  })
                } finally {
                  setConfirmDialogOpen(false)
                  setSelectedOrderToClose(null)
                }
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
