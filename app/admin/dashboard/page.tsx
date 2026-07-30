"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { AlertCircle, Banknote, Package, Ruler } from "lucide-react"
import { formatMeters } from "../measurements"
import {
  ProductionCostsModal,
  type ProductionCostsForm,
} from "../components/ProductionCostsModal"

type DashboardPreset = "this_month" | "last_month" | "last_3_months" | "custom"
type DashboardGranularity = "day" | "week" | "month" | "year"
type ChartMetric = "orders" | "items"

type Summary = {
  ordersCount: number
  itemsSum: number
  metersTotal: number
  missingQuantities: number[]
}

type SeriesPoint = { bucket: string; orders: number; items: number }
type TopQuantity = { quantity: number; orderCount: number }
type TopItem = { code: string; count: number; image_url: string | null }
type TopCustomer = { customer_name: string; itemsSum: number; ordersCount: number }

const PRESET_OPTIONS: { value: DashboardPreset; label: string }[] = [
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
  { value: "last_3_months", label: "Últimos 3 meses" },
  { value: "custom", label: "Período personalizado" },
]

const GRANULARITY_OPTIONS: { value: DashboardGranularity; label: string }[] = [
  { value: "day", label: "Por dia" },
  { value: "week", label: "Por semana" },
  { value: "month", label: "Por mês" },
  { value: "year", label: "Por ano" },
]

const METRIC_OPTIONS: { value: ChartMetric; label: string }[] = [
  { value: "orders", label: "Pedidos" },
  { value: "items", label: "Itens" },
]

const chartConfig = {
  orders: { label: "Pedidos", color: "hsl(221.2 83.2% 53.3%)" },
  items: { label: "Itens", color: "hsl(142.1 76.2% 36.3%)" },
} satisfies ChartConfig

function formatBucketLabel(iso: string, granularity: DashboardGranularity): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  if (granularity === "year") {
    return d.toLocaleDateString("pt-BR", { year: "numeric", timeZone: "UTC" })
  }
  if (granularity === "month") {
    return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" })
  }
  if (granularity === "week") {
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })
}

function formatInt(n: number): string {
  return n.toLocaleString("pt-BR")
}

function formatBrl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export default function AdminDashboardPage() {
  const [preset, setPreset] = useState<DashboardPreset>("this_month")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [granularity, setGranularity] = useState<DashboardGranularity>("day")
  const [chartMetric, setChartMetric] = useState<ChartMetric>("orders")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [series, setSeries] = useState<SeriesPoint[]>([])
  const [topQuantities, setTopQuantities] = useState<TopQuantity[]>([])
  const [topItems, setTopItems] = useState<TopItem[]>([])
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([])
  const [previewItem, setPreviewItem] = useState<{ code: string; url: string } | null>(null)
  const [costsModalOpen, setCostsModalOpen] = useState(false)
  const [productionCosts, setProductionCosts] = useState<ProductionCostsForm>({
    cutSewPerItem: 0,
    fabricPerMeter: 0,
    packagingPerOrder: 0,
  })

  const loadProductionCosts = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/production-costs", { credentials: "include" })
      if (!res.ok) return
      const data = await res.json()
      if (data.costs) {
        setProductionCosts({
          cutSewPerItem: Number(data.costs.cutSewPerItem) || 0,
          fabricPerMeter: Number(data.costs.fabricPerMeter) || 0,
          packagingPerOrder: Number(data.costs.packagingPerOrder) || 0,
        })
      }
    } catch {
      // mantém zeros
    }
  }, [])

  const loadDashboard = useCallback(async () => {
    if (preset === "custom" && (!customFrom || !customTo)) {
      setError("Informe data início e data fim para o período personalizado")
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      params.set("preset", preset)
      params.set("granularity", granularity)
      if (preset === "custom") {
        params.set("from", customFrom)
        params.set("to", customTo)
      }
      const res = await fetch(`/api/admin/dashboard?${params.toString()}`, {
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || data.message || "Erro ao carregar dashboard")
      }
      setSummary(data.summary)
      setSeries(data.series || [])
      setTopQuantities(data.topQuantities || [])
      setTopItems(data.topItems || [])
      setTopCustomers(data.topCustomers || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido")
      setSummary(null)
      setSeries([])
      setTopQuantities([])
      setTopItems([])
      setTopCustomers([])
    } finally {
      setLoading(false)
    }
  }, [preset, customFrom, customTo, granularity])

  useEffect(() => {
    loadProductionCosts()
  }, [loadProductionCosts])

  useEffect(() => {
    if (preset === "custom" && (!customFrom || !customTo)) {
      setLoading(false)
      setError("Informe data início e data fim para o período personalizado")
      return
    }
    loadDashboard()
  }, [loadDashboard, preset, customFrom, customTo])

  const chartData = useMemo(
    () =>
      series.map((p) => ({
        label: formatBucketLabel(p.bucket, granularity),
        orders: p.orders,
        items: p.items,
      })),
    [series, granularity]
  )

  const productionCostBreakdown = useMemo(() => {
    if (!summary) {
      return { fabric: 0, cutSew: 0, packaging: 0, total: 0 }
    }
    const fabric = productionCosts.fabricPerMeter * summary.metersTotal
    const cutSew = productionCosts.cutSewPerItem * summary.itemsSum
    const packaging = productionCosts.packagingPerOrder * summary.ordersCount
    return {
      fabric,
      cutSew,
      packaging,
      total: fabric + cutSew + packaging,
    }
  }, [summary, productionCosts])

  return (
    <div className="max-w-6xl mx-auto w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Resumo de pedidos finalizados no período</p>
        </div>
        <Button variant="outline" onClick={() => setCostsModalOpen(true)}>
          <Banknote className="w-4 h-4 mr-2" />
          Custos
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1 min-w-[200px]">
              <Label>Período</Label>
              <Select
                value={preset}
                onValueChange={(v) => setPreset(v as DashboardPreset)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {preset === "custom" && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="dash-from">Data início</Label>
                  <Input
                    id="dash-from"
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-[160px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dash-to">Data fim</Label>
                  <Input
                    id="dash-to"
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="w-[160px]"
                  />
                </div>
                <Button onClick={loadDashboard} disabled={!customFrom || !customTo}>
                  Aplicar
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
        </div>
      )}

      {!loading && error && (
        <Card>
          <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
            <AlertCircle className="w-10 h-10 text-red-500" />
            <p className="text-red-600">{error}</p>
            <Button variant="outline" onClick={loadDashboard}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && summary && (
        <>
          {/* Linha 1 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Pedidos finalizados
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-stretch">
                  <div className="flex-1 pr-4">
                    <p className="text-xs text-gray-500">Pedidos</p>
                    <p className="text-2xl font-bold tabular-nums text-gray-900">
                      {formatInt(summary.ordersCount)}
                    </p>
                  </div>
                  <div className="w-px bg-gray-200 self-stretch" aria-hidden />
                  <div className="flex-1 pl-4">
                    <p className="text-xs text-gray-500">Itens</p>
                    <p className="text-2xl font-bold tabular-nums text-gray-900">
                      {formatInt(summary.itemsSum)}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  Total de pedidos finalizados e soma dos itens no período.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Ruler className="w-4 h-4" />
                  Metragem total
                </CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {formatMeters(summary.metersTotal)} metros
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summary.missingQuantities.length > 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                    Quantidades sem medida cadastrada (fora da soma):{" "}
                    {summary.missingQuantities.join(", ")}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">Soma dos metros de tecido dos pedidos finalizados.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Banknote className="w-4 h-4" />
                  Custos Produção
                </CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {formatBrl(productionCostBreakdown.total)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm text-gray-700">
                <div className="flex justify-between gap-2">
                  <span>Tecido Sublimado</span>
                  <span className="font-medium tabular-nums shrink-0">
                    {formatBrl(productionCostBreakdown.fabric)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Corte/Costura</span>
                  <span className="font-medium tabular-nums shrink-0">
                    {formatBrl(productionCostBreakdown.cutSew)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Embalagem</span>
                  <span className="font-medium tabular-nums shrink-0">
                    {formatBrl(productionCostBreakdown.packaging)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Linha 2 */}
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-lg">
                  {chartMetric === "orders" ? "Evolução de pedidos" : "Evolução de itens"}
                </CardTitle>
                <CardDescription>
                  {chartMetric === "orders"
                    ? "Pedidos finalizados no período"
                    : "Soma de itens dos pedidos finalizados no período"}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2 ml-auto">
                <Select
                  value={chartMetric}
                  onValueChange={(v) => setChartMetric(v as ChartMetric)}
                >
                  <SelectTrigger className="w-[130px]" aria-label="Métrica do gráfico">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METRIC_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={granularity}
                  onValueChange={(v) => setGranularity(v as DashboardGranularity)}
                >
                  <SelectTrigger className="w-[140px]" aria-label="Granularidade do gráfico">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRANULARITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <p className="text-center text-gray-500 py-12">Sem dados no período selecionado.</p>
              ) : (
                <ChartContainer config={chartConfig} className="h-[320px] w-full aspect-auto">
                  <LineChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis tickLine={false} axisLine={false} width={48} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey={chartMetric}
                      stroke={`var(--color-${chartMetric})`}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Linha 3 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="flex flex-col h-[420px]">
              <CardHeader className="pb-2 shrink-0">
                <CardTitle className="text-base">Top 10 Quantidades</CardTitle>
                <CardDescription>Pedidos por quantidade de unidades</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1">
                {topQuantities.length === 0 ? (
                  <p className="text-sm text-gray-500">Sem dados.</p>
                ) : (
                  topQuantities.map((row, idx) => (
                    <div
                      key={row.quantity}
                      className="flex justify-between gap-2 text-sm border-b border-gray-100 py-2"
                    >
                      <span>
                        {idx + 1} — Pedidos de {row.quantity} Unidades
                      </span>
                      <span className="font-semibold tabular-nums shrink-0">{formatInt(row.orderCount)}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="flex flex-col h-[420px]">
              <CardHeader className="pb-2 shrink-0">
                <CardTitle className="text-base">Top 50 Itens</CardTitle>
                <CardDescription>Mais escolhidos no período</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto min-h-0 space-y-3 pr-1">
                {topItems.length === 0 ? (
                  <p className="text-sm text-gray-500">Sem dados.</p>
                ) : (
                  topItems.map((item) => (
                    <div key={item.code} className="flex items-stretch gap-3 border-b border-gray-100 pb-3">
                      <div className="w-[77px] shrink-0 flex flex-col items-center text-center">
                        {item.image_url ? (
                          <button
                            type="button"
                            onClick={() => setPreviewItem({ code: item.code, url: item.image_url! })}
                            className="p-0 border-0 bg-transparent cursor-zoom-in rounded overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            aria-label={`Ampliar ${item.code}`}
                          >
                            <img
                              src={item.image_url}
                              alt={item.code}
                              className="w-[77px] h-[77px] object-cover rounded"
                            />
                          </button>
                        ) : (
                          <div className="w-[77px] h-[77px] bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400">
                            Sem imagem
                          </div>
                        )}
                        <p className="text-sm font-medium mt-1 w-full truncate" title={item.code}>
                          {item.code}
                        </p>
                      </div>
                      <div className="flex-1 flex items-center justify-center">
                        <span className="text-base font-semibold tabular-nums">
                          {formatInt(item.count)} un.
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="flex flex-col h-[420px]">
              <CardHeader className="pb-2 shrink-0">
                <CardTitle className="text-base">Top 10 Clientes</CardTitle>
                <CardDescription>Por soma de itens no período</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1">
                {topCustomers.length === 0 ? (
                  <p className="text-sm text-gray-500">Sem dados.</p>
                ) : (
                  topCustomers.map((row, idx) => (
                    <div
                      key={`${row.customer_name}-${idx}`}
                      className="border-b border-gray-100 py-2 text-sm"
                    >
                      <p className="font-medium truncate" title={row.customer_name}>
                        {idx + 1}. {row.customer_name}
                      </p>
                      <p className="text-gray-600">
                        {formatInt(row.itemsSum)} itens · {formatInt(row.ordersCount)} pedidos
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
          <Dialog
            open={!!previewItem}
            onOpenChange={(open) => {
              if (!open) setPreviewItem(null)
            }}
          >
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{previewItem?.code ?? "Imagem"}</DialogTitle>
              </DialogHeader>
              {previewItem && (
                <img
                  src={previewItem.url}
                  alt={previewItem.code}
                  className="w-full max-h-[70vh] object-contain rounded"
                />
              )}
            </DialogContent>
          </Dialog>
        </>
      )}

      <ProductionCostsModal
        open={costsModalOpen}
        onOpenChange={setCostsModalOpen}
        onSaved={setProductionCosts}
      />
    </div>
  )
}
