"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Download, Calendar, User, Package, ArrowLeft, AlertCircle, FolderOpen, Copy, Check, ChevronDown } from "lucide-react"
import { useRouter } from "next/navigation"
import { Toaster } from "sonner"
import { useToast } from "@/hooks/use-sonner-toast"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type Order = {
  id: string
  customer_name: string
  quantity_purchased: number
  selected_images: string[]
  created_at: string
  order: string
}

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const router = useRouter()
  const toast = useToast()
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/catalogointerativo"

  // Usar variável de ambiente pública para a senha (em produção, use autenticação adequada)
  const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin123"

  useEffect(() => {
    if (isAuthenticated) {
      loadOrders()
    }
  }, [isAuthenticated])

  useEffect(() => {
    filterOrders()
  }, [orders, dateFilter])

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

      const response = await fetch(`${basePath}/api/orders`)

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
    if (!dateFilter) {
      setFilteredOrders(orders)
      return
    }

    try {
      console.log(`Filtrando pedidos por data: ${dateFilter}`)
      const response = await fetch(`${basePath}/api/orders?date=${dateFilter}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Erro ao filtrar pedidos: ${errorData.message || response.status}`)
      }

      const filtered = await response.json()
      console.log(`${filtered.length} pedidos filtrados`)
      setFilteredOrders(filtered || [])
    } catch (error) {
      console.error("Erro ao filtrar pedidos:", error)
      setError(error instanceof Error ? error.message : "Erro desconhecido")
    }
  }

  const initializeDatabase = async () => {
    try {
      setError(null)
      setLoading(true)

      console.log("Inicializando banco de dados...")
      const response = await fetch(`${basePath}/api/init-db`, {
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

  const downloadOrderFiles = async (selectedImages: string[]) => {
    // Em uma implementação real, você faria o download dos arquivos
    // Por enquanto, apenas mostramos um alerta
    alert(`Download iniciado para ${selectedImages.length} arquivos:\n${selectedImages.join(", ")}`)
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
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder={`Senha padrão: ${ADMIN_PASSWORD}`}
              />
            </div>
            <Button onClick={handleLogin} className="w-full">
              Entrar
            </Button>
            <Button variant="outline" onClick={() => router.push(`${basePath}/`)} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Início
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
              <Button variant="outline" onClick={() => router.push(`${basePath}/`)} className="w-full">
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
            <Button variant="outline" onClick={() => router.push(`${basePath}/admin/files`)}>
              <FolderOpen className="w-4 h-4 mr-2" />
              Gerenciar Arquivos
            </Button>
            <Button variant="outline" onClick={() => router.push(`${basePath}/`)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Início
            </Button>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Package className="w-8 h-8 text-indigo-600 mr-3" />
                <div>
                  <p className="text-sm text-gray-600">Total de Pedidos</p>
                  <p className="text-2xl font-bold">{orders.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <User className="w-8 h-8 text-green-600 mr-3" />
                <div>
                  <p className="text-sm text-gray-600">Clientes Únicos</p>
                  <p className="text-2xl font-bold">{new Set(orders.map((o) => o.customer_name)).size}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Download className="w-8 h-8 text-orange-600 mr-3" />
                <div>
                  <p className="text-sm text-gray-600">Imagens Selecionadas</p>
                  <p className="text-2xl font-bold">
                    {orders.reduce((acc, order) => acc + order.selected_images.length, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="date-filter">Filtrar por data</Label>
                <Input
                  id="date-filter"
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={() => setDateFilter("")}>
                  Limpar Filtro
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de pedidos */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Pedidos</CardTitle>
            <CardDescription>{filteredOrders.length} pedido(s) encontrado(s)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
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
                        <TableCell>{formatDate(order.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{order.quantity_purchased} produtos</Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-[200px]">
                                <div className="p-2 flex items-center justify-between border-b">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2"
                                    onClick={() => copyAllImages(order.selected_images)}
                                  >
                                    <Copy className="h-4 w-4 mr-1" />
                                    Copiar Tudo
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
                          <Button size="sm" onClick={() => downloadOrderFiles(order.selected_images)}>
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
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
    </div>
  )
}
