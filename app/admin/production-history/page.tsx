"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, History } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-sonner-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

type Batch = {
  id: string
  created_at: string
  order_count: number
}

type Order = {
  id: string
  customer_name: string
  quantity_purchased: number
  order: string
  is_pending: boolean
  in_production: boolean
  in_production_at: string | null
  finalized_at: string | null
  updated_at: string
}

const PAGE_SIZE = 20

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString("pt-BR")
}

function generateOrderReference(order: Order): string {
  const completionDate = order.is_pending ? null : new Date(order.updated_at)
  if (!completionDate) return "Pendente"
  const day = completionDate.getDate().toString().padStart(2, "0")
  const month = (completionDate.getMonth() + 1).toString().padStart(2, "0")
  const year = completionDate.getFullYear().toString()
  const dateString = `${day}${month}${year}`
  const priceTable: Record<number, string> = {
    2: "1,58", 4: "1,58", 6: "1,58", 8: "1,67", 10: "2,22", 11: "2,26", 12: "2,44",
    16: "3,33", 17: "3,37", 20: "3,89", 21: "4,09", 24: "4,65", 26: "5,03", 28: "5,55",
    30: "5,76", 32: "6,10", 35: "6,71", 36: "6,87", 40: "7,76", 60: "11,32",
  }
  const price = priceTable[order.quantity_purchased] || "N/A"
  return `${order.order}-${dateString}-50x50 ${price}`
}

export default function ProductionHistoryPage() {
  const router = useRouter()
  const toast = useToast()
  const [batches, setBatches] = useState<Batch[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [periodFrom, setPeriodFrom] = useState("")
  const [periodTo, setPeriodTo] = useState("")
  const [listDialogOpen, setListDialogOpen] = useState(false)
  const [selectedBatchOrders, setSelectedBatchOrders] = useState<Order[]>([])
  const [loadingBatch, setLoadingBatch] = useState(false)

  useEffect(() => {
    loadBatches()
  }, [page, periodFrom, periodTo])

  const loadBatches = async () => {
    try {
      setError(null)
      setLoading(true)
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("pageSize", String(PAGE_SIZE))
      if (periodFrom) params.set("periodFrom", periodFrom)
      if (periodTo) params.set("periodTo", periodTo)
      const res = await fetch(`/api/production-history?${params.toString()}`)
      if (!res.ok) throw new Error("Erro ao carregar histórico")
      const data = await res.json()
      setBatches(data.batches || [])
      setTotal(data.total ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido")
    } finally {
      setLoading(false)
    }
  }

  const openBatchList = async (batchId: string) => {
    setLoadingBatch(true)
    setListDialogOpen(true)
    setSelectedBatchOrders([])
    try {
      const res = await fetch(`/api/production-history/${batchId}/orders`)
      if (!res.ok) throw new Error("Erro ao carregar pedidos do lote")
      const orders = await res.json()
      setSelectedBatchOrders(orders)
    } catch (e) {
      toast.error({
        title: "Erro",
        description: e instanceof Error ? e.message : "Erro ao carregar lote",
      })
    } finally {
      setLoadingBatch(false)
    }
  }

  const copyReferences = () => {
    const text = selectedBatchOrders.map((o) => generateOrderReference(o)).join("\n")
    navigator.clipboard.writeText(text).then(
      () => toast.success({ title: "Copiado", description: "Referências copiadas para a área de transferência." }),
      () => toast.error({ title: "Erro", description: "Não foi possível copiar." }),
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <History className="w-7 h-7" />
              Histórico de Produção
            </h1>
            <p className="text-gray-600">Lotes de pedidos colocados em produção</p>
          </div>
          <Button variant="outline" onClick={() => router.push("/admin")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Painel
          </Button>
        </div>

        <Card className="mb-4">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-2">Filtrar por período (data do lote)</p>
            <div className="flex flex-wrap items-center gap-2">
              <Input type="date" value={periodFrom} onChange={(e) => { setPeriodFrom(e.target.value); setPage(1) }} className="w-[140px]" />
              <span className="text-gray-500">até</span>
              <Input type="date" value={periodTo} onChange={(e) => { setPeriodTo(e.target.value); setPage(1) }} className="w-[140px]" />
              <Button variant="outline" size="sm" onClick={() => { setPeriodFrom(""); setPeriodTo(""); setPage(1) }}>
                Limpar
              </Button>
            </div>
          </CardContent>
        </Card>

        {loading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
          </div>
        )}

        {error && (
          <Card>
            <CardContent className="p-6 text-center text-red-600">
              {error}
              <Button className="mt-2" variant="outline" onClick={loadBatches}>Tentar novamente</Button>
            </CardContent>
          </Card>
        )}

        {!loading && !error && (
          <Card>
            <CardHeader>
              <CardTitle>Lotes</CardTitle>
              <CardDescription>
                {total > 0 ? `${total} lote(s)` : "Nenhum lote no período"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {batches.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nenhum lote encontrado.</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data / Hora</TableHead>
                        <TableHead>Pedidos</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batches.map((batch) => (
                        <TableRow key={batch.id}>
                          <TableCell>{formatDate(batch.created_at)}</TableCell>
                          <TableCell>{batch.order_count}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" className="mr-2" onClick={() => openBatchList(batch.id)}>
                              Ver lista
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                const res = await fetch(`/api/production-history/${batch.id}/orders`)
                                if (!res.ok) return
                                const orders: Order[] = await res.json()
                                const text = orders.map((o) => generateOrderReference(o)).join("\n")
                                await navigator.clipboard.writeText(text)
                                toast.success({ title: "Copiado", description: "Referências copiadas." })
                              }}
                            >
                              Copiar referências
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {total > PAGE_SIZE && (
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-sm text-gray-500">
                        Página {page} de {Math.ceil(total / PAGE_SIZE)}
                      </p>
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              href="#"
                              onClick={(e) => { e.preventDefault(); if (page > 1) setPage((p) => p - 1) }}
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
                </>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog open={listDialogOpen} onOpenChange={setListDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Lista do lote</DialogTitle>
            </DialogHeader>
            {loadingBatch ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
              </div>
            ) : (
              <div className="space-y-2">
                {selectedBatchOrders.map((order) => (
                  <div key={order.id} className="text-sm py-1 border-b border-gray-100">
                    <span className="font-medium">{order.order}</span> — {order.customer_name} — {generateOrderReference(order)}
                  </div>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setListDialogOpen(false)}>Fechar</Button>
              <Button onClick={copyReferences} disabled={selectedBatchOrders.length === 0}>
                Copiar referências
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  )
}
