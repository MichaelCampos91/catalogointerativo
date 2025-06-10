"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, MessageCircle, Check, AlertCircle, Search, AlertTriangle } from "lucide-react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Category = {
  id: string
  name: string
  slug: string
}

type CatalogImage = {
  id: string
  code: string
  category_id: string
  image_url: string
  thumbnail_url: string | null
}

type PaginationInfo = {
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function CatalogPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [images, setImages] = useState<CatalogImage[]>([])
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [customerData, setCustomerData] = useState<{ name: string; quantity: number; orderNumber: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isAware, setIsAware] = useState(false)
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 1
  })
  const [loadingMore, setLoadingMore] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number>(24 * 60 * 60) // 24 horas em segundos
  const router = useRouter()
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/catalogointerativo"

  useEffect(() => {
    const data = localStorage.getItem("customerData")
    if (!data) {
      router.push("/")
      return
    }
    setCustomerData(JSON.parse(data))
  
    loadCatalogData()

    // Inicializar o cronômetro
    const savedTime = localStorage.getItem("catalogTimer")
    if (savedTime) {
      const endTime = parseInt(savedTime)
      const now = Math.floor(Date.now() / 1000)
      const remaining = Math.max(0, endTime - now)
      setTimeLeft(remaining)
    } else {
      const endTime = Math.floor(Date.now() / 1000) + (2 * 60 * 60)
      localStorage.setItem("catalogTimer", endTime.toString())
    }
  }, [router])

  // Efeito para atualizar o cronômetro
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Função para formatar o tempo restante
  const formatTimeLeft = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  const loadCatalogData = async (page = 1, category?: string) => {
    try {
      setError(null)
      if (page === 1) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }

      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString()
      })
      
      if (category) {
        queryParams.append('category', category)
      }

      // Carregar dados do catálogo
      const response = await fetch(`/api/catalog?${queryParams.toString()}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Erro ao carregar catálogo: ${errorData.message || response.status}`)
      }

      const data = await response.json()

      if (page === 1) {
        setCategories(data.categories || [])
        setImages(data.images || [])
      } else {
        setImages(prev => [...prev, ...data.images])
      }
      
      setPagination(data.pagination)
    } catch (error) {
      console.error("Erro ao carregar dados:", error)
      setError(error instanceof Error ? error.message : "Erro desconhecido ao carregar dados")
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const loadMore = () => {
    if (pagination.page < pagination.totalPages && !loadingMore) {
      loadCatalogData(pagination.page + 1)
    }
  }

  // Função para detectar quando o usuário chegou ao final da página
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    if (scrollHeight - scrollTop <= clientHeight * 1.5) {
      loadMore()
    }
  }

  const handleImageSelect = (imageCode: string) => {
    if (!customerData) return

    if (selectedImages.includes(imageCode)) {
      setSelectedImages((prev) => prev.filter((code) => code !== imageCode))
    } else if (selectedImages.length < customerData.quantity) {
      setSelectedImages((prev) => [...prev, imageCode])
    }
  }

  const handleConfirmOrder = async () => {
    if (!customerData || !isAware) return

    const message = `Olá! Meu nome é *${customerData.name}* e esses são os temas que escolhi do catálogo:\n\n${selectedImages.map((code) => `*${code}*`).join("\n")} \n Nº do pedido: *${customerData.orderNumber}*`

    // Salvar pedido no banco
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_name: customerData.name,
          quantity_purchased: customerData.quantity,
          selected_images: selectedImages,
          whatsapp_message: message,
          order: customerData.orderNumber,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error("Erro ao salvar pedido:", errorData)
        throw new Error(errorData.message || "Erro ao salvar pedido")
      }

      // Limpar localStorage
      localStorage.removeItem("customerData")
      localStorage.removeItem("sessionLocked")

      // Abrir WhatsApp após salvar com sucesso
      const whatsappUrl = `https://wa.me/?phone=5518997003934&text=${encodeURIComponent(message)}`
      window.open(whatsappUrl, "_blank")
      
      // Fechar o modal
      setShowConfirmDialog(false)
      setIsAware(false)

      // Redirecionar para outro site
      router.push("https://descubra.lojacenario.com.br")
    } catch (error) {
      console.error("Erro ao salvar pedido:", error)
      setError(error instanceof Error ? error.message : "Erro ao salvar pedido")
    }
  }

  const getImagesByCategory = (categoryId: string) => {
    return images.filter((img) => img.category_id === categoryId)
  }

  // Função para filtrar categorias baseado na busca
  const getFilteredCategories = () => {
    if (!searchQuery.trim()) return categories

    const query = searchQuery.toLowerCase()
    return categories.filter(category => 
      category.name.toLowerCase().includes(query)
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center overflow-hidden">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p>Carregando catálogo...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Erro ao Carregar Catálogo</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="space-y-2">
              <Button onClick={() => loadCatalogData()} className="w-full">
                Tentar Novamente
              </Button>
              <Button variant="outline" onClick={() => router.push("/catalog")} className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao Início
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!customerData) {
    return null
  }

  const isSelectionComplete = selectedImages.length === customerData.quantity
  const filteredCategories = getFilteredCategories()

  return (
    <div className="min-h-screen bg-gray-50 overflow-hidden">
      {/* Header fixo */}
      <div className="sticky top-0 bg-white border-b z-20">
        <div className="max-w-4xl mx-auto">
          {/* Nav */}
          <div className="flex items-center justify-between p-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/catalog")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <div className="text-center">
              <p className="font-medium">Olá, {customerData.name}!</p>
              <Badge variant={isSelectionComplete ? "default" : "secondary"}>
                {selectedImages.length}/{customerData.quantity} selecionadas
              </Badge>
            </div>
          </div>

          {/* Campo de busca fixo */}
          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Buscar Temas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Cronômetro */}
          <div className="px-4 pb-4 text-center">
            <p className="text-sm text-gray-600">
              Você tem <span className="font-bold text-indigo-600">{formatTimeLeft(timeLeft)} hrs</span> para finalizar a seleção.
            </p>
          </div>
        </div>
      </div>

      <div 
        className="max-w-4xl mx-auto p-4 pb-20 overflow-y-auto"
        style={{ height: 'calc(100vh - 120px)' }}
        onScroll={handleScroll}
      >
        {filteredCategories.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {searchQuery ? "Nenhum resultado encontrado para sua busca." : "Nenhum tema encontrado."}
            </p>
          </div>
        ) : (
          filteredCategories.map((category) => {
            const categoryImages = getImagesByCategory(category.id)
            if (categoryImages.length === 0) return null

            return (
              <div key={category.id} className="mb-8">
                <h2 className="text-xl font-bold mb-4 text-gray-900">{category.name}</h2>

                <div className="relative">
                  <div className="overflow-x-auto pb-4">
                    <div className="inline-flex gap-3 min-w-full">
                      {categoryImages.map((image) => {
                        const isSelected = selectedImages.includes(image.code)
                        const isDisabled = !isSelected && selectedImages.length >= customerData.quantity

                        return (
                          <Card
                            key={image.id}
                            className={`relative cursor-pointer transition-all flex-shrink-0 w-[200px] ${
                              isSelected ? "ring-2 ring-indigo-500" : ""
                            } ${isDisabled ? "opacity-50" : "hover:shadow-md"}`}
                            onClick={() => !isDisabled && handleImageSelect(image.code)}
                          >
                            <CardContent className="p-0">
                              <div className="relative aspect-square">
                                <img
                                  src={image.image_url}
                                  alt={image.code}
                                  className="object-cover w-full h-full"
                                />
                                {isSelected && (
                                  <div className="absolute inset-0 bg-indigo-500 bg-opacity-20 flex items-center justify-center">
                                    <Check className="w-8 h-8 text-indigo-500" />
                                  </div>
                                )}
                              </div>
                              <div className="p-2 text-center">
                                <p className="text-sm font-medium">{image.code}</p>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}

        {loadingMore && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Carregando mais imagens...</p>
          </div>
        )}

        {/* Modal de Confirmação */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex justify-center mb-4">
                <AlertTriangle className="w-12 h-12 text-yellow-500" />
              </div>
              <DialogTitle className="text-center">Confirmar Pedido</DialogTitle>
              <DialogDescription className="text-center">
                Você está prestes a confirmar seu pedido com {selectedImages.length} imagens selecionadas.
                Após a confirmação, você será redirecionado para o WhatsApp para finalizar o processo.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center space-x-2 mt-4">
              <Checkbox
                id="aware"
                checked={isAware}
                onCheckedChange={(checked) => setIsAware(checked as boolean)}
              />
              <label
                htmlFor="aware"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Estou ciente que não poderei alterar minha seleção após a confirmação
              </label>
            </div>
            <div className="flex justify-end mt-6">
              <Button
                onClick={handleConfirmOrder}
                disabled={!isAware}
                className="w-full"
              >
                Confirmar Pedido
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Botão de WhatsApp */}
        {selectedImages.length > 0 && (
          <div className="fixed bottom-4 left-0 right-0 flex justify-center">
            <Button
              size="lg"
              className="shadow-lg"
              onClick={() => setShowConfirmDialog(true)}
              disabled={!isSelectionComplete}
            >
              <Check className="w-5 h-5 mr-2" />
              {isSelectionComplete ? "Confirmar Pedido" : "Selecione mais imagens"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
