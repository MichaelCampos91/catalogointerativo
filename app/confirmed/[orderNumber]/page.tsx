"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Calendar, User, Package, CheckCircle } from "lucide-react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

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
        
        // Carregar URLs das imagens
        if (orderData.selected_images && orderData.selected_images.length > 0) {
          await loadImageUrls(orderData.selected_images)
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

  const getImageUrl = (imageCode: string) => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ""
    // Remover extensão se existir para construir a URL corretamente
    const cleanCode = imageCode.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '')
    // Remover pontos extras no final também
    const finalCode = cleanCode.replace(/\.+$/, '')
    return `${basePath}/files/${finalCode}.jpg`
  }

  const PLACEHOLDER_URL = "/files/Z/placeholder.svg"

  const loadImageUrls = async (imageCodes: string[]) => {
    try {
      // Buscar lista completa no novo endpoint dinâmico, como no catálogo
      const res = await fetch(`/api/files?all=true&limit=9999&page=1`)
      if (!res.ok) throw new Error('Falha ao listar arquivos')
      const j = await res.json()

      // Mapear code -> url a partir de `images` e `categories[*].images`
      const codeToUrl: Record<string, string> = {}
      if (Array.isArray(j.images)) {
        for (const img of j.images) {
          if (img && img.code && img.url) codeToUrl[img.code] = img.url
        }
      }
      if (Array.isArray(j.categories)) {
        for (const cat of j.categories) {
          if (cat && Array.isArray(cat.images)) {
            for (const img of cat.images) {
              if (img && img.code && img.url) codeToUrl[img.code] = img.url
            }
          }
        }
      }

      const urls: ImageUrl[] = imageCodes.map((code) => ({
        code,
        url: codeToUrl[code] || PLACEHOLDER_URL,
      }))
      setImageUrls(urls)
    } catch (e) {
      // Fallback: tentar endpoint legado por código
      try {
        const urls: ImageUrl[] = []
        for (const code of imageCodes) {
          try {
            const r = await fetch(`/api/images?code=${encodeURIComponent(code)}`)
            if (r.ok) {
              const d = await r.json()
              urls.push({ code, url: d.url })
            } else {
              urls.push({ code, url: PLACEHOLDER_URL })
            }
          } catch {
            urls.push({ code, url: PLACEHOLDER_URL })
          }
        }
        setImageUrls(urls)
      } catch (error) {
        console.error('Erro ao carregar URLs das imagens:', error)
        const urls = imageCodes.map((code) => ({ code, url: PLACEHOLDER_URL }))
        setImageUrls(urls)
      }
    }
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
            <CheckCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
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
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <img className="w-[120px]" src="/logo.png" alt="Logo"/>
          </div>
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
            <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              {imageUrls.map((image, index) => (
                <Card key={index} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="relative aspect-square">
                      <img
                        src={image.url}
                        alt={image.code}
                        className="object-cover w-full h-full"
                        onError={(e) => {
                          if (e.currentTarget.src !== window.location.origin + PLACEHOLDER_URL) {
                            e.currentTarget.src = PLACEHOLDER_URL
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