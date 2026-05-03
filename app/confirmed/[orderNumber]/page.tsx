"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, User, Package, CheckCircle, ListOrdered, AlertCircle } from "lucide-react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { resolveImageUrls, PLACEHOLDER_IMAGE_URL } from "@/lib/image-urls"

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

type ImageUrl = {
  code: string
  url: string
}

export default function ConfirmedPage() {
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imageUrls, setImageUrls] = useState<ImageUrl[]>([])
  const [showAlreadyConfirmedBanner, setShowAlreadyConfirmedBanner] = useState(false)
  const router = useRouter()
  const params = useParams()
  const orderNumber = params.orderNumber as string

  useEffect(() => {
    const loadOrder = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/orders?order=${encodeURIComponent(orderNumber)}`)

        if (!response.ok) {
          throw new Error("Pedido não encontrado")
        }

        const data = await response.json()

        if (data.length === 0) {
          setError("Pedido não encontrado")
          return
        }

        const orderData = data[0]
        setOrder(orderData)

        // Banner "já confirmado" só aparece quando NÃO é a primeira visita logo após confirmação.
        try {
          const justConfirmed = localStorage.getItem(`justConfirmed:${orderNumber}`)
          if (justConfirmed) {
            localStorage.removeItem(`justConfirmed:${orderNumber}`)
            setShowAlreadyConfirmedBanner(false)
          } else {
            setShowAlreadyConfirmedBanner(true)
          }
        } catch {
          setShowAlreadyConfirmedBanner(true)
        }

        if (orderData.selected_images && orderData.selected_images.length > 0) {
          const map = await resolveImageUrls(orderData.selected_images)
          setImageUrls(orderData.selected_images.map((code: string) => ({ code, url: map[code] ?? PLACEHOLDER_IMAGE_URL })))
        }
      } catch (error) {
        console.error("Erro ao carregar pedido:", error)
        setError(error instanceof Error ? error.message : "Erro ao carregar pedido")
      } finally {
        setLoading(false)
      }
    }

    if (orderNumber) {
      loadOrder()
    }
  }, [orderNumber])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("pt-BR")
  }

  const formatBannerDate = (dateString: string) => {
    const d = new Date(dateString)
    const date = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d)
    const time = new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d)
    return `${date}, ${time}h`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p>Carregando detalhes do pedido...</p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Erro ao Carregar Pedido</h2>
            <p className="text-gray-600 mb-4">{error || "Pedido não encontrado"}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4">
        {/* Banner de pedido já confirmado (só em revisitas) */}
        {showAlreadyConfirmedBanner && (
          <div className="mb-4 rounded-md border border-yellow-300 bg-yellow-50 p-4 text-yellow-900 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-yellow-600" />
              <div className="space-y-1">
                <p className="font-semibold">Este pedido já foi confirmado e não pode ser alterado.</p>
                <p className="text-sm">Data da confirmação: {formatBannerDate(order.created_at)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <img className="w-[120px]" src="/logo.png" alt="Logo"/>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push(`/orders/${encodeURIComponent(order.customer_name)}`)}
          >
            <ListOrdered className="w-4 h-4 mr-2" />
            Ver todos os meus pedidos
          </Button>
        </div>

        {/* Card de confirmação */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-center mb-2 text-green-600">
              Pedido Confirmado com Sucesso!
            </h2>
            <p className="text-center text-gray-600 mb-6">
              Seu pedido foi registrado e está sendo processado.
            </p>
          </CardContent>
        </Card>

        {/* Informações do pedido */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-5 h-5 text-indigo-600" />
                <span className="text-sm text-gray-500">Cliente</span>
              </div>
              <p className="font-semibold text-lg">{order.customer_name.toUpperCase()}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-5 h-5 text-indigo-600" />
                <span className="text-sm text-gray-500">Número do Pedido</span>
              </div>
              <p className="font-semibold text-lg">{order.order}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="w-5 h-5 text-indigo-600" />
                <span className="text-sm text-gray-500">Quantidade</span>
              </div>
              <p className="font-semibold text-lg">{order.quantity_purchased} itens</p>
            </CardContent>
          </Card>
        </div>

        {/* Data de confirmação */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <span className="text-sm text-gray-500">Data de Confirmação</span>
            </div>
            <p className="font-semibold">{formatDate(order.created_at)}</p>
          </CardContent>
        </Card>

        {/* Imagens selecionadas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold">Itens Selecionados</CardTitle>
            <CardDescription>
              {order.selected_images.length} item(s) selecionado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
              {imageUrls.map((image, index) => (
                <Card key={`${image.code}-${index}`} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="relative aspect-square">
                      <img
                        src={image.url}
                        alt={image.code}
                        className="object-cover w-full h-full"
                        onError={(e) => {
                          if (e.currentTarget.src !== window.location.origin + PLACEHOLDER_IMAGE_URL) {
                            e.currentTarget.src = PLACEHOLDER_IMAGE_URL
                          }
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <img
                          src="/logo.png"
                          alt="Logo"
                          className="w-16 opacity-40"
                        />
                      </div>
                    </div>
                    <div className="p-2 text-center">
                      <p className="text-sm font-medium">{image.code}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
