"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Download, User, Package, ArrowLeft, AlertCircle, Copy, Check, ChevronDown, Search } from "lucide-react"
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

import type { OrderStatusFilter } from "@/lib/database"

const PAGE_SIZE = 20
const STATUS_OPTIONS: { key: OrderStatusFilter; label: string }[] = [
  { key: "pending", label: "Pendentes" },
  { key: "art_mounted", label: "Com arte montada" },
  { key: "in_production", label: "Em produção" },
  { key: "finalized", label: "Finalizados" },
  { key: "canceled", label: "Cancelados" },
]

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
  canceled_at: string | null
}

function getActiveStatusFilters(statusFilters: Record<OrderStatusFilter, boolean>): OrderStatusFilter[] {
  return STATUS_OPTIONS.filter((o) => statusFilters[o.key]).map((o) => o.key)
}

export default function AdminPage() {
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilters, setStatusFilters] = useState<Record<OrderStatusFilter, boolean>>({
    pending: true,
    art_mounted: false,
    in_production: false,
    finalized: false,
    canceled: false,
  })
  const [periodFrom, setPeriodFrom] = useState("")
  const [periodTo, setPeriodTo] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const router = useRouter()
  const toast = useToast()
  const [downloadingOrder, setDownloadingOrder] = useState<string | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [selectedOrderToClose, setSelectedOrderToClose] = useState<Order | null>(null)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [selectedOrderToCancel, setSelectedOrderToCancel] = useState<Order | null>(null)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [productionDialogOpen, setProductionDialogOpen] = useState(false)
  const [selectedOrdersForList, setSelectedOrdersForList] = useState<string[]>([])
  const [listDialogOpen, setListDialogOpen] = useState(false)
  const [selectedOrdersDataForList, setSelectedOrdersDataForList] = useState<Order[]>([])

  useEffect(() => {
    loadFilteredOrders(1)
  }, [])

  useEffect(() => {
    const active = getActiveStatusFilters(statusFilters)
    if (active.length === 0) return
    loadFilteredOrders(page)
  }, [statusFilters, periodFrom, periodTo, searchQuery, page])

  useEffect(() => {
    setSelectedOrders([])
    setSelectedOrdersForList([])
  }, [statusFilters, periodFrom, periodTo, searchQuery])

  const loadFilteredOrders = async (pageNum: number = 1) => {
    const active = getActiveStatusFilters(statusFilters)
    if (active.length === 0) return
    try {
      setError(null)
      setLoading(true)
      const params = new URLSearchParams()
      active.forEach((s) => params.append("status", s))
      if (periodFrom) params.set("periodFrom", periodFrom)
      if (periodTo) params.set("periodTo", periodTo)
      if (searchQuery.trim()) params.set("search", searchQuery.trim())
      params.set("page", String(pageNum))
      params.set("pageSize", String(PAGE_SIZE))
      const response = await fetch(`/api/orders?${params.toString()}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Erro ${response.status}`)
      }
      const data = await response.json()
      setFilteredOrders(data.orders || [])
      setTotal(data.total ?? 0)
      setPage(data.page ?? pageNum)
    } catch (error) {
      console.error("Erro ao carregar pedidos:", error)
      setError(error instanceof Error ? error.message : "Erro desconhecido")
    } finally {
      setLoading(false)
    }
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

      await loadFilteredOrders(1)
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

      // Avisos do servidor (duplicatas ignoradas)
      const warningHeader = response.headers.get('X-Warning')
      if (warningHeader) {
        const decoded = warningHeader
          .split(' | ')
          .map((s) => {
            try { return decodeURIComponent(s) } catch { return s }
          })
          .join('\n')
        toast.warning({
          title: "Aviso",
          description: decoded,
        })
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

  const isOrderArtMounted = (order: Order) =>
    !order.is_pending && !order.in_production && !order.finalized_at && !order.canceled_at
  const isOrderForList = (order: Order) =>
    (order.in_production && !order.finalized_at && !order.canceled_at) || (!!order.finalized_at && !order.canceled_at)

  const handleOrderSelection = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrders((prev) => [...prev, orderId])
    } else {
      setSelectedOrders((prev) => prev.filter((id) => id !== orderId))
    }
  }

  const handleSelectAllPage = (checked: boolean) => {
    if (checked) {
      const pageIds = filteredOrders.map((o) => o.id)
      setSelectedOrders((prev) => [...new Set([...prev, ...filteredOrders.filter(isOrderArtMounted).map((o) => o.id)])])
      setSelectedOrdersForList((prev) => [...new Set([...prev, ...filteredOrders.filter(isOrderForList).map((o) => o.id)])])
    } else {
      const pageIds = filteredOrders.map((o) => o.id)
      setSelectedOrders((prev) => prev.filter((id) => !pageIds.includes(id)))
      setSelectedOrdersForList((prev) => prev.filter((id) => !pageIds.includes(id)))
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: selectedOrders }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Erro ao marcar pedidos como em produção")
      }

      await response.json()
      setSelectedOrders([])
      setProductionDialogOpen(false)
      await loadFilteredOrders(page)
      toast.success({
        title: "Pedidos marcados como em produção",
        description: "Os pedidos foram marcados como em produção e o lote foi registrado no histórico.",
      })
    } catch (error) {
      console.error("Erro ao marcar pedidos como em produção:", error)
      toast.error({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      })
    }
  }

  const handleCancelOrder = async () => {
    if (!selectedOrderToCancel) return

    try {
      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancel: true, id: selectedOrderToCancel.id }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Erro ao cancelar pedido")
      }

      setCancelDialogOpen(false)
      setSelectedOrderToCancel(null)
      await loadFilteredOrders(page)
      toast.success({
        title: "Pedido cancelado",
        description: "O pedido foi marcado como cancelado",
      })
    } catch (error) {
      console.error("Erro ao cancelar pedido:", error)
      toast.error({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      })
    }
  }

  const handleOrderSelectionForList = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrdersForList((prev) => [...prev, orderId])
    } else {
      setSelectedOrdersForList((prev) => prev.filter((id) => id !== orderId))
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
      const idsParam = selectedOrdersForList.join(",")
      let ordersData: Order[] = await (await fetch(`/api/orders?ids=${encodeURIComponent(idsParam)}`)).json()
      const allFinalized = ordersData.every((o) => !!o.finalized_at)
      if (!allFinalized) {
        const response = await fetch("/api/orders", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ finalize: true, orderIds: selectedOrdersForList }),
        })
        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.message || "Erro ao finalizar pedidos")
        }
        await response.json()
        ordersData = await (await fetch(`/api/orders?ids=${encodeURIComponent(idsParam)}`)).json()
      }
      setSelectedOrdersDataForList(ordersData)
      setListDialogOpen(true)
      await loadFilteredOrders(page)
    } catch (error) {
      toast.error({
        title: "Erro ao gerar lista",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      })
    }
  }

  const handlePrintList = () => {
    const selectedOrdersData = selectedOrdersDataForList
    
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
    const orderNumbers = selectedOrdersDataForList.map((order) => order.order).join("\n")
    copyToClipboard(orderNumbers)
  }

  const handleCopyReferences = () => {
    // Usar o estado separado para garantir que os dados não mudem após atualização
    const references = selectedOrdersDataForList.map(order => generateOrderReference(order)).join('\n')
    copyToClipboard(references)
  }

  // Helper: obter medida de material pela quantidade
  function getMeasureForQuantity(quantity: number): string {
    const measureTable: { [key: number]: string } = {
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
      60: "11,32",
    }
    return measureTable[quantity] || "N/A"
  }

  // Copiar como tabela (Referência \t Medida)
  const handleCopyReferencesAsTable = () => {
    const lines = selectedOrdersDataForList.map((order) => {
      const refWithMeasure = generateOrderReference(order)
      const lastSpace = refWithMeasure.lastIndexOf(" ")
      const reference = lastSpace > -1 ? refWithMeasure.slice(0, lastSpace) : refWithMeasure
      const measure = getMeasureForQuantity(order.quantity_purchased)
      return `${reference}\t${measure}`
    })
    copyToClipboard(lines.join("\n"))
  }

  const allPageSelected =
    filteredOrders.length > 0 &&
    filteredOrders.every((o) => {
      if (isOrderArtMounted(o)) return selectedOrders.includes(o.id)
      if (isOrderForList(o)) return selectedOrdersForList.includes(o.id)
      return true
    })

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
              <Button onClick={() => loadFilteredOrders(page)} className="w-full">
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
    <>
    <div className="max-w-6xl mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Painel Administrativo</h1>
          <p className="text-gray-600">Gerencie os pedidos do catálogo</p>
        </div>

        {/* Filtros: Status (checkboxes) */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-2">Status (marque um ou mais)</p>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={STATUS_OPTIONS.every((o) => statusFilters[o.key])}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setStatusFilters({
                        pending: true,
                        art_mounted: true,
                        in_production: true,
                        finalized: true,
                        canceled: true,
                      })
                    } else {
                      setStatusFilters({
                        pending: true,
                        art_mounted: false,
                        in_production: false,
                        finalized: false,
                        canceled: false,
                      })
                    }
                    setPage(1)
                  }}
                />
                <span className="text-sm font-medium">Todos</span>
              </label>
              {STATUS_OPTIONS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={statusFilters[key]}
                    onCheckedChange={(checked) => {
                      const next = { ...statusFilters, [key]: !!checked }
                      if (!checked && getActiveStatusFilters(next).length === 0) return
                      setStatusFilters(next)
                      setPage(1)
                    }}
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Período (opcional) e Busca */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <Card className="md:col-span-2">
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 mb-2">Período (data de criação do pedido)</p>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  value={periodFrom}
                  onChange={(e) => { setPeriodFrom(e.target.value); setPage(1) }}
                  className="w-[140px]"
                />
                <span className="text-gray-500">até</span>
                <Input
                  type="date"
                  value={periodTo}
                  onChange={(e) => { setPeriodTo(e.target.value); setPage(1) }}
                  className="w-[140px]"
                />
                <Button variant="outline" size="sm" onClick={() => { setPeriodFrom(""); setPeriodTo(""); setPage(1) }}>
                  Limpar período
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 mb-2">Buscar por nome ou número do pedido</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    type="text"
                    placeholder="Digite e pressione Enter..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { setSearchQuery(searchInput); setPage(1) } }}
                    className="pl-9 pr-9"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                    onClick={() => { setSearchInput(""); setSearchQuery(""); setPage(1) }}
                  >
                    Limpar
                  </Button>
                </div>
                <Button
                  type="button"
                  onClick={() => { setSearchQuery(searchInput); setPage(1) }}
                >
                  Buscar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Total de Pedidos (filtro)</p>
                  <p className="text-xl font-bold">{total}</p>
                </div>
                <Package className="w-8 h-8 text-indigo-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Total de Clientes (página)</p>
                  <p className="text-xl font-bold">{new Set(filteredOrders.map((o) => o.customer_name)).size}</p>
                </div>
                <User className="w-8 h-8 text-indigo-600" />
              </div>
            </CardContent>
          </Card>
        </div>
        

        {/* Tabela de pedidos */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg font-bold">Lista de Pedidos</CardTitle>
                <CardDescription className="text-sm">
                  {total > 0
                    ? `Exibindo ${(page - 1) * PAGE_SIZE + 1} a ${Math.min(page * PAGE_SIZE, total)} de ${total} pedido(s)`
                    : "Nenhum pedido com os filtros selecionados"}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {selectedOrders.length > 0 && (
                  <Button
                    onClick={() => setProductionDialogOpen(true)}
                    className="bg-primary hover:bg-primary/90 text-white"
                  >
                    Colocar em Produção ({selectedOrders.length})
                  </Button>
                )}
                {selectedOrdersForList.length > 0 && (
                  <Button
                    onClick={handleGenerateList}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Gerar Lista ({selectedOrdersForList.length})
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto overflow-y-auto md:max-h-[320px] max-h-[320px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allPageSelected}
                        onCheckedChange={(c) => handleSelectAllPage(!!c)}
                      />
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
                          {isOrderArtMounted(order) && (
                            <Checkbox
                              checked={selectedOrders.includes(order.id)}
                              onCheckedChange={(c) => handleOrderSelection(order.id, !!c)}
                            />
                          )}
                          {isOrderForList(order) && (
                            <Checkbox
                              checked={selectedOrdersForList.includes(order.id)}
                              onCheckedChange={(c) => handleOrderSelectionForList(order.id, !!c)}
                            />
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
                          {order.canceled_at && (
                            <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                              ❌ Cancelado
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
                          {order.canceled_at && (
                            <p className="text-xs text-gray-700 mt-2">
                              <span className="font-medium text-red-600">
                                ❌ Cancelado em:
                              </span>
                              <br/>
                              {formatDate(order.canceled_at)}
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
                            {order.finalized_at || order.canceled_at ? null : (
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
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="ml-2"
                                  onClick={() => {
                                    setSelectedOrderToCancel(order)
                                    setCancelDialogOpen(true)
                                  }}
                                >
                                  Cancelar
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
            {total > PAGE_SIZE && (
              <div className="mt-4 flex items-center justify-between w-full ">
                <p className="text-sm text-gray-500 whitespace-nowrap px-2">Página {page} de {Math.ceil(total / PAGE_SIZE) || 1}</p>
                <Pagination>
                  <PaginationContent className="w-full justify-end gap-2">
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          if (page > 1) setPage((p) => p - 1)
                        }}
                        className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          if (page < Math.ceil(total / PAGE_SIZE)) setPage((p) => p + 1)
                        }}
                        className={page >= Math.ceil(total / PAGE_SIZE) ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
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
      
                  await response.json()
                  await loadFilteredOrders(page)
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

      {/* Dialog de confirmação de cancelamento de pedido */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Pedido?</DialogTitle>
          </DialogHeader>
          <p>Tem certeza que deseja cancelar este pedido? Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Não, manter pedido
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelOrder}
            >
              Sim, cancelar pedido
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
              <Button onClick={handleCopyReferencesAsTable}>
                Copiar Tabela
              </Button>
              <Button onClick={handleCopyReferences}>
                Copiar Referências
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
