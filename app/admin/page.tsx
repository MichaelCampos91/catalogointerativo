"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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

import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"

import { createOrder, getOrders, getOrdersByDate, getOrdersByCompletionDate, getOrdersByProductionDate, updateOrderStatus, getOrdersByOrderNumber, markOrdersInProduction } from "@/lib/database"
import { NextResponse } from "next/server"

type Order = {
  id: string
  customer_name: string
  quantity_purchased: number
  selected_images: string[]
  created_at: string
  updated_at: string
  order: string
  is_pending: boolean
  in_production: boolean
  in_production_at: string | null
  finalized_at: string | null
}

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState("")
  const [completionDateFilter, setCompletionDateFilter] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const router = useRouter()
  const toast = useToast()
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/catalogointerativo"
  const [downloadingOrder, setDownloadingOrder] = useState<string | null>(null)
  // Definir o filtro 'Somente Pendentes' como padrão
  const [filterPending, setFilterPending] = useState<"all" | "pending" | "completed" | "in_production" | "finalized">("pending")
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [selectedOrderToClose, setSelectedOrderToClose] = useState<Order | null>(null)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [productionDialogOpen, setProductionDialogOpen] = useState(false)
  const [productionDateFilter, setProductionDateFilter] = useState("")
  const [selectedOrdersForList, setSelectedOrdersForList] = useState<string[]>([])
  const [listDialogOpen, setListDialogOpen] = useState(false)
  const [finalizedDateFilter, setFinalizedDateFilter] = useState("")
  const [selectedOrdersDataForList, setSelectedOrdersDataForList] = useState<Order[]>([])

  // Usar variável de ambiente pública para a senha (em produção, use autenticação adequada)
  const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || ""

  useEffect(() => {
    if (isAuthenticated) {
      loadOrders()
    }
  }, [isAuthenticated])

  useEffect(() => {
    filterOrders()
  }, [orders, dateFilter, completionDateFilter, productionDateFilter, filterPending, searchQuery, finalizedDateFilter])

  // Limpar seleções quando os filtros mudam
  useEffect(() => {
    setSelectedOrders([])
    setSelectedOrdersForList([])
  }, [dateFilter, completionDateFilter, productionDateFilter, filterPending, searchQuery, finalizedDateFilter])

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
    console.log("filterOrders chamada com:", {
      dateFilter,
      completionDateFilter,
      productionDateFilter,
      filterPending,
      searchQuery
    })

    if (!dateFilter && !completionDateFilter && !productionDateFilter && !finalizedDateFilter && filterPending === "all" && !searchQuery) {
      setFilteredOrders(orders)
      return
    }
  
    let filtered = orders
  
    if (productionDateFilter) {
      try {
        console.log("Filtrando por data de produção:", productionDateFilter)
        const response = await fetch(`/api/orders?productionDate=${productionDateFilter}`)
        if (!response.ok) throw new Error("Erro ao filtrar por data de produção")
        filtered = await response.json()
        console.log("Pedidos filtrados por data de produção:", filtered.length)
      } catch (error) {
        console.error("Erro ao filtrar por data de produção:", error)
        setError(error instanceof Error ? error.message : "Erro desconhecido")
        return
      }
    } else if (completionDateFilter) {
      try {
        const response = await fetch(`/api/orders?completionDate=${completionDateFilter}`)
        if (!response.ok) throw new Error("Erro ao filtrar por data de conclusão")
        filtered = await response.json()
      } catch (error) {
        console.error("Erro ao filtrar por data de conclusão:", error)
        setError(error instanceof Error ? error.message : "Erro desconhecido")
        return
      }
    } else if (dateFilter) {
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

    // Filtro por data de finalização (aplicado localmente)
    if (finalizedDateFilter) {
      filtered = filtered.filter(order => order.finalized_at && order.finalized_at.startsWith(finalizedDateFilter))
    }
  
    // Aplicar filtros de status após buscar dados do servidor
    if (filterPending === "pending") {
      filtered = filtered.filter((order) => order.is_pending)
    } else if (filterPending === "completed") {
      filtered = filtered.filter((order) => !order.is_pending)
    } else if (filterPending === "in_production") {
      filtered = filtered.filter((order) => order.in_production === true && !order.finalized_at)
    } else if (filterPending === "finalized") {
      filtered = filtered.filter((order) => !!order.finalized_at)
    }

    // Busca por nome do cliente ou número do pedido
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((order) => 
        order.customer_name.toLowerCase().includes(query) ||
        order.order.toLowerCase().includes(query)
      )
    }
  
    console.log("Pedidos filtrados finais:", filtered.length)
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
      toast.info({
        title: "Preparando download...",
        description: "Estamos montando o arquivo para você",
      })
      
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
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData?.message || "Erro ao preparar download")
      }

      // Receber o blob diretamente
      const blob = await response.blob()
      
      // Criar URL temporária para o blob
      const url = window.URL.createObjectURL(blob)
      
      // Criar link temporário e clicar
      const a = document.createElement('a')
      a.href = url
      a.download = `${order.created_at.split('T')[0]}_${order.customer_name}_${order.order}.zip`
      document.body.appendChild(a)
      a.click()
      
      // Limpar
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast.success({
        title: "Download iniciado",
        description: `Arquivo ZIP baixado com sucesso`,
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
      await navigator.clipboard.writeText(text.toUpperCase())
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

  const handleOrderSelection = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrders(prev => [...prev, orderId])
    } else {
      setSelectedOrders(prev => prev.filter(id => id !== orderId))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const availableOrders = filteredOrders.filter(order => !order.in_production)
      setSelectedOrders(availableOrders.map(order => order.id))
    } else {
      setSelectedOrders([])
    }
  }

  const handleMarkInProduction = async () => {
    if (selectedOrders.length === 0) {
      toast.error({
        title: "Nenhum pedido selecionado",
        description: "Selecione pelo menos um pedido para marcar como em produção",
      })
      return
    }

    try {
      const response = await fetch("/api/orders", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderIds: selectedOrders }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Erro ao marcar pedidos como em produção")
      }

      const updatedOrders = await response.json()
      
      // Atualizar a lista de pedidos
      setOrders(prev => 
        prev.map(order => {
          const updated = updatedOrders.find((u: Order) => u.id === order.id)
          return updated || order
        })
      )

      // Limpar seleção
      setSelectedOrders([])
      setProductionDialogOpen(false)

      toast.success({
        title: "Pedidos marcados como em produção",
        description: `${updatedOrders.length} pedido(s) foram marcados como em produção`,
      })
    } catch (error) {
      console.error("Erro ao marcar pedidos como em produção:", error)
      toast.error({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      })
    }
  }

  const handleOrderSelectionForList = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrdersForList(prev => [...prev, orderId])
    } else {
      setSelectedOrdersForList(prev => prev.filter(id => id !== orderId))
    }
  }

  const handleSelectAllForList = (checked: boolean) => {
    if (checked) {
      setSelectedOrdersForList(filteredOrders.map(order => order.id))
    } else {
      setSelectedOrdersForList([])
    }
  }

  const handleGenerateList = async () => {
    if (selectedOrdersForList.length === 0) {
      toast.error({
        title: "Nenhum pedido selecionado",
        description: "Selecione pelo menos um pedido para gerar a lista",
      })
      return
    }
    try {
      // Salvar os dados dos pedidos selecionados ANTES de atualizar o status
      const selectedOrdersData = filteredOrders.filter(order => 
        selectedOrdersForList.includes(order.id)
      )
      setSelectedOrdersDataForList(selectedOrdersData)
      // Verificar se todos os pedidos já estão finalizados (quando filtro é 'finalized')
      if (filterPending === "finalized") {
        const allFinalized = selectedOrdersForList.every(id => {
          const order = orders.find(o => o.id === id)
          return order && !!order.finalized_at
        })
        if (allFinalized) {
          setListDialogOpen(true)
          return
        }
      }
      // Finalizar pedidos selecionados (apenas se não estiverem finalizados)
      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalize: true, orderIds: selectedOrdersForList }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Erro ao finalizar pedidos")
      }
      const updated = await response.json()
      setOrders((prev) =>
        prev.map((order) => {
          const found = updated.find((u: Order) => u.id === order.id)
          return found ? { ...order, ...found } : order
        })
      )
      setListDialogOpen(true)
    } catch (error) {
      toast.error({
        title: "Erro ao finalizar pedidos",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      })
    }
  }

  const handlePrintList = () => {
    const selectedOrdersData = filteredOrders.filter(order => 
      selectedOrdersForList.includes(order.id)
    )
    
    const printContent = `
      <html>
        <head>
          <title>Lista de Pedidos em Produção</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .header { text-align: center; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Lista de Pedidos em Produção</h1>
            <p>Data: ${new Date().toLocaleDateString('pt-BR')}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>Em Produção Desde</th>
                <th>Referência</th>
              </tr>
            </thead>
            <tbody>
              ${selectedOrdersData.map(order => `
                <tr>
                  <td>${order.id}</td>
                  <td>${order.customer_name}</td>
                  <td>${formatDate(order.in_production_at!)}</td>
                  <td>${generateOrderReference(order)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `
    
    const printWindow = window.open('', '_blank')
    printWindow?.document.write(printContent)
    printWindow?.document.close()
    printWindow?.print()
  }

  const handleCopyOrderNumbers = () => {
    const selectedOrdersData = filteredOrders.filter(order => 
      selectedOrdersForList.includes(order.id)
    )
    
    const orderNumbers = selectedOrdersData.map(order => order.order).join('\n')
    copyToClipboard(orderNumbers)
  }

  const handleCopyReferences = () => {
    // Usar o estado separado para garantir que os dados não mudem após atualização
    const references = selectedOrdersDataForList.map(order => generateOrderReference(order)).join('\n')
    copyToClipboard(references)
  }

  // Nova função: checa se todos os pedidos selecionados estão em produção
  const canGenerateList = () => {
    if (selectedOrdersForList.length === 0) return false
    if (filterPending === "in_production") {
      // Lógica atual
      return selectedOrdersForList.every(id => {
        const order = orders.find(o => o.id === id)
        return order && order.in_production && !order.finalized_at
      })
    }
    if (filterPending === "finalized" && finalizedDateFilter) {
      // Nova lógica para finalizados
      return selectedOrdersForList.every(id => {
        const order = orders.find(o => o.id === id)
        return order && !!order.finalized_at
      })
    }
    return false
  }

  // Atualizar shouldShowSpecialCheckboxes para depender do filtro de status e data de finalização
  const shouldShowSpecialCheckboxes = () => {
    return filterPending === "in_production" || (filterPending === "finalized" && finalizedDateFilter)
  }

  // Função para gerar a referência do pedido
  const generateOrderReference = (order: Order) => {
    // Obter a data de conclusão (updated_at quando is_pending = false)
    const completionDate = order.is_pending ? null : new Date(order.updated_at)
    
    if (!completionDate) {
      return "Pendente"
    }

    // Formatar data como DDMMYYYY (sem caracteres)
    const day = completionDate.getDate().toString().padStart(2, '0')
    const month = (completionDate.getMonth() + 1).toString().padStart(2, '0')
    const year = completionDate.getFullYear().toString() // 4 dígitos
    const dateString = `${day}${month}${year}`

    // Tabela de preços baseada na quantidade
    const priceTable: { [key: number]: string } = {
      2: "1,58",
      4: "1,58", 
      6: "1,58",
      8: "1,67",
      10: "2,22",
      11: "2,26",
      12: "2,44",
      16: "3,33",
      17: "3,37",
      20: "3,89",
      21: "4,09",
      24: "4,65",
      26: "5,03",
      28: "5,55",
      30: "5,76",
      32: "6,10",
      35: "6,71",
      36: "6,87",
      40: "7,76",
      60: "11,32"
    }

    const quantity = order.quantity_purchased
    const price = priceTable[quantity] || "N/A"

    // Novo formato: [Número do pedido]-data-50x50 metragem
    return `${order.order}-${dateString}-50x50 ${price}`
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
      <div className="max-w-6xl mx-auto w-full">
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
                 filterPending === "completed" ? "Somente Com Arte Montada" : 
                 filterPending === "in_production" ? "Somente Em Produção" :
                 filterPending === "finalized" ? "Somente Finalizados" :
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
                Somente Com Arte Montada
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterPending("in_production")}>
                Somente Em Produção
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterPending("finalized")}>
                Somente Finalizados
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>

        {/* Filtros */}
        
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          {/* Total de Pedidos */}
          <Card className="col-span-1">
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
          {/* Total de Clientes */}
          <Card className="col-span-1">
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
          {/* Criado em */}
          <Card className="col-span-1">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-2">Criado em</p>
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
                  Limpar
                </Button>
              </div>
            </CardContent>
          </Card>
          {/* Arte Montada em */}
          <Card className="col-span-1">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-2">Arte Montada em</p>
                  <Input
                    className="text-xs"
                    id="completionDate"
                    type="date"
                    value={completionDateFilter}
                    onChange={(e) => setCompletionDateFilter(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => setCompletionDateFilter("")}
                  className="mt-6"
                >
                  Limpar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Em produção desde */}
          <Card className="col-span-1">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-2">Em produção desde</p>
                  <Input
                    className="text-xs"
                    id="productionDate"
                    type="date"
                    value={productionDateFilter}
                    onChange={(e) => setProductionDateFilter(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => setProductionDateFilter("")}
                  className="mt-6"
                >
                  Limpar
                </Button>
              </div>
            </CardContent>
          </Card>
          {/* Finalizado em */}
          <Card className="col-span-1">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-2">Finalizado em</p>
                  <Input
                    className="text-xs"
                    id="finalizedDate"
                    type="date"
                    value={finalizedDateFilter}
                    onChange={(e) => setFinalizedDateFilter(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => setFinalizedDateFilter("")}
                  className="mt-6"
                >
                  Limpar
                </Button>
              </div>
            </CardContent>
          </Card>
          {/* Campo de busca */}
          <Card className="mb-6 col-span-2">
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
        </div>
        

        {/* Tabela de pedidos */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold">Lista de Pedidos</CardTitle>
                <CardDescription className="text-sm">
                  {searchQuery 
                    ? `${filteredOrders.length} pedido(s) encontrado(s) para "${searchQuery}"`
                    : `${filteredOrders.length} pedido(s) encontrado(s)`
                  }
                </CardDescription>
              </div>
              {selectedOrders.length > 0 && (
                <Button
                  onClick={() => setProductionDialogOpen(true)}
                  className="bg-primary hover:bg-primary/20 text-white"
                >
                  🏭 Colocar em Produção ({selectedOrders.length})
                </Button>
              )}
              {shouldShowSpecialCheckboxes() && canGenerateList() && (
                <Button
                  onClick={handleGenerateList}
                  className="bg-blue-600 hover:bg-blue-700 text-white ml-2"
                >
                  📋 Gerar Lista ({selectedOrdersForList.length})
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto overflow-y-auto md:max-h-[320px] max-h-[320px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      {shouldShowSpecialCheckboxes() ? (
                        <Checkbox
                          checked={selectedOrdersForList.length > 0 && selectedOrdersForList.length === filteredOrders.length}
                          onCheckedChange={handleSelectAllForList}
                        />
                      ) : (
                        <Checkbox
                          checked={selectedOrders.length > 0 && selectedOrders.length === filteredOrders.filter(order => !order.in_production).length}
                          onCheckedChange={handleSelectAll}
                        />
                      )}
                    </TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="overflow-y-auto h-[300px]">
                  {filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-gray-500">
                        Nenhum pedido encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          {shouldShowSpecialCheckboxes() ? (
                            <Checkbox
                              checked={selectedOrdersForList.includes(order.id)}
                              onCheckedChange={(checked) => handleOrderSelectionForList(order.id, checked as boolean)}
                            />
                          ) : (
                            !order.finalized_at && (
                              <Checkbox
                                checked={selectedOrders.includes(order.id)}
                                onCheckedChange={(checked) => handleOrderSelection(order.id, checked as boolean)}
                              />
                            )
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <p className="font-medium">{order.customer_name.toUpperCase()}</p>
                              <button
                                onClick={() => copyToClipboard(order.customer_name)}
                                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                            <button
                              onClick={() => copyToClipboard(order.order)}
                              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                            >
                              <span>{order.order}</span>
                              <Copy className="w-3 h-3 mr-1" />
                            </button>
                            {order.finalized_at && (
                              <p className="text-xs text-blue-600 flex items-center gap-1 mt-1">
                                {generateOrderReference(order)}
                                <button onClick={() => copyToClipboard(generateOrderReference(order))} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors">
                                  <Copy className="w-3 h-3" />
                                </button>
                              </p>
                            )}
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
                                ✅ Arte Montada em:
                              </span>
                              <br/>
                              {formatDate(order.updated_at)}
                            </p>
                          )}
                          {order.in_production && (
                            <p className="text-xs text-gray-700 mt-2">
                              <span className="font-medium text-orange-600">
                                🏭 Em produção desde:
                              </span>
                              <br/>
                              {formatDate(order.in_production_at!)}
                            </p>
                          )}
                          {order.finalized_at && (
                            <p className="text-xs text-gray-700 mt-2">
                              <span className="font-medium text-green-600">
                                ✅ Finalizado em:
                              </span>
                              <br/>
                              {formatDate(order.finalized_at)}
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
                              <DropdownMenuContent align="end" className="w-[180px] md:max-h-[300px] max-h-[300px] overflow-y-auto">
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
                            {order.finalized_at ? null : (
                              <>
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

      {/* Dialog de confirmação de conclusão de pedido */}
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
                    body: JSON.stringify({ id: selectedOrderToClose.order }),
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

      {/* Dialog de confirmação de colocação de pedidos em produção */}
      <Dialog open={productionDialogOpen} onOpenChange={setProductionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Colocar Pedidos em Produção?</DialogTitle>
          </DialogHeader>
          <p>
            Tem certeza que deseja marcar {selectedOrders.length} pedido(s) como "em produção"? 
            Esta ação registrará a data e hora atuais como início da produção.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductionDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleMarkInProduction}
              className="bg-primary hover:bg-primary/20"
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de lista de pedidos em produção */}
      <Dialog open={listDialogOpen} onOpenChange={(open) => {
        setListDialogOpen(open)
        if (!open) setSelectedOrdersDataForList([]) // Limpar ao fechar
      }}>
        <DialogContent className="max-w-4xl md:max-h-[80vh] md:h-full max-h-[60vh] h-full overflow-y-auto" style={{ maxHeight: '60vh' }}>
          <DialogHeader>
            <DialogTitle>Lista de Pedidos em Produção</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {selectedOrdersDataForList
                .map((order) => (
                  <Card key={order.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="font-medium">ID: {order.id}</p>
                          <p className="text-sm text-gray-600">
                            Cliente: {order.customer_name}
                          </p>
                          <p className="text-sm text-gray-600">
                            Número do Pedido: {order.order}
                          </p>
                          <p className="text-sm text-gray-600">
                            Quantidade: {order.quantity_purchased}
                          </p>
                          <p className="text-sm text-gray-600">
                            Criado em: {formatDate(order.created_at)}
                          </p>
                          <p className="text-sm text-gray-600">
                            Em Produção Desde: {formatDate(order.in_production_at!)}
                          </p>
                          <p className="text-sm font-medium text-blue-600">
                            Referência: {generateOrderReference(order)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setListDialogOpen(false)}>
                Fechar
              </Button>
              <Button onClick={handlePrintList}>
                Imprimir Lista
              </Button>
              <Button onClick={handleCopyOrderNumbers}>
                Copiar Números
              </Button>
              <Button onClick={handleCopyReferences}>
                Copiar Referências
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
