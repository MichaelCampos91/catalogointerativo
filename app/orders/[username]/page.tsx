"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { ArrowLeft, Eye, Package, AlertCircle } from "lucide-react"
import { resolveImageUrls, PLACEHOLDER_IMAGE_URL } from "@/lib/image-urls"

type CustomerOrder = {
  id: string
  order: string
  quantity_purchased: number
  selected_images: string[]
  created_at: string
  customer_name: string
}

function aggregateImageCounts(images: string[]) {
  return images.reduce<Record<string, number>>((acc, code) => {
    acc[code] = (acc[code] ?? 0) + 1
    return acc
  }, {})
}

export default function CustomerOrdersPage() {
  const router = useRouter()
  const params = useParams()
  const username = decodeURIComponent((params.username as string) || "")

  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imagesMap, setImagesMap] = useState<Record<string, string>>({})
  const [openOrder, setOpenOrder] = useState<CustomerOrder | null>(null)

  useEffect(() => {
    if (!username) {
      setError("Usuário inválido")
      setLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/orders/by-customer?name=${encodeURIComponent(username)}`)
        if (!res.ok) {
          throw new Error("Falha ao carregar pedidos")
        }
        const data = await res.json()
        if (cancelled) return
        const list: CustomerOrder[] = Array.isArray(data.orders) ? data.orders : []
        setOrders(list)

        // Resolve URLs de imagens de todos os pedidos para o modal.
        if (list.length > 0) {
          const codes = Array.from(new Set(list.flatMap((o) => o.selected_images)))
          if (codes.length > 0) {
            const map = await resolveImageUrls(codes)
            if (!cancelled) setImagesMap(map)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro desconhecido")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [username])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("pt-BR")
  }

  const openOrderItems = useMemo(() => {
    if (!openOrder) return []
    const counts = aggregateImageCounts(openOrder.selected_images)
    return Object.entries(counts).map(([code, quantity]) => ({ code, quantity }))
  }, [openOrder])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <img className="w-[120px]" src="/logo.png" alt="Logo" />
          <Button variant="outline" onClick={() => router.push("/catalog")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao catálogo
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Meus pedidos</CardTitle>
            <CardDescription>
              Pedidos confirmados de <span className="font-semibold">{username.toUpperCase()}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Carregando pedidos...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <p className="text-gray-600">{error}</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Nenhum pedido confirmado encontrado.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((o) => (
                  <Card key={o.id} className="border">
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-indigo-600" />
                          <p className="font-semibold">Pedido {o.order}</p>
                        </div>
                        <p className="text-sm text-gray-600">
                          Confirmado em <span className="font-medium">{formatDate(o.created_at)}</span>
                        </p>
                        <Badge variant="secondary">{o.quantity_purchased} {o.quantity_purchased === 1 ? "item" : "itens"}</Badge>
                      </div>
                      <Button onClick={() => setOpenOrder(o)} size="sm">
                        <Eye className="w-4 h-4 mr-2" />
                        Ver itens
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal com miniaturas dos itens (mesmo estilo do modal de confirmação do /catalog) */}
      <Dialog open={!!openOrder} onOpenChange={(open) => !open && setOpenOrder(null)}>
        <DialogContent className="w-[95vw] sm:w-auto sm:max-w-lg md:max-w-2xl lg:max-w-3xl xl:max-w-4xl max-w-full overflow-hidden p-0">
          <div className="flex flex-col max-h-[80vh] sm:max-h-[85vh]">
            <DialogHeader className="px-4 pt-4 pb-2">
              <DialogTitle className="text-center text-lg sm:text-xl">
                Itens do pedido {openOrder?.order ?? ""}
              </DialogTitle>
              <DialogDescription className="text-center text-sm sm:text-base">
                {openOrder ? `${openOrder.selected_images.length}/${openOrder.quantity_purchased} item(s)` : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-hidden px-4 pb-4 space-y-4">
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[60vh] overflow-y-auto px-2 pt-2 pb-4">
                {openOrderItems.map(({ code, quantity }) => {
                  const url = imagesMap[code] ?? PLACEHOLDER_IMAGE_URL
                  return (
                    <div key={code} className="relative">
                      <div className="w-full aspect-square rounded-lg overflow-hidden border-2 border-gray-200 relative bg-gray-100">
                        <img
                          src={url}
                          alt={code}
                          className="w-full h-full object-cover select-none"
                          onContextMenu={(e) => e.preventDefault()}
                          draggable={false}
                          onError={(e) => {
                            if (e.currentTarget.src !== window.location.origin + PLACEHOLDER_IMAGE_URL) {
                              e.currentTarget.src = PLACEHOLDER_IMAGE_URL
                            }
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <img src="/logo.png" alt="Logo" className="w-10 sm:w-12 opacity-40" />
                        </div>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white shadow">
                          {quantity}x
                        </div>
                      </div>
                      <p className="text-[11px] sm:text-xs text-center mt-1 font-medium text-gray-600 truncate" title={code}>
                        {code}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
