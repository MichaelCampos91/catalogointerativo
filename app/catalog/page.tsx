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
  }, [router])

  const loadCatalogData = async () => {
    try {
      setError(null)
      console.log("Carregando dados do catálogo...")

      // Carregar dados do catálogo
      const response = await fetch("/api/catalog")
      console.log("Resposta catálogo:", response.status)

      if (!response.ok) {
        const errorData = await response.json()
        console.error("Erro na resposta do catálogo:", errorData)
        throw new Error(`Erro ao carregar catálogo: ${errorData.message || response.status}`)
      }

      const data = await response.json()
      console.log("Dados carregados:", data)

      setCategories(data.categories || [])
      setImages(data.images || [])
    } catch (error) {
      console.error("Erro ao carregar dados:", error)
      setError(error instanceof Error ? error.message : "Erro desconhecido ao carregar dados")
    } finally {
      setLoading(false)
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p>Carregando catálogo...</p>
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
            <h2 className="text-xl font-bold mb-2">Erro ao Carregar Catálogo</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="space-y-2">
              <Button onClick={loadCatalogData} className="w-full">
                Tentar Novamente
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

  if (!customerData) {
    return null
  }

  const isSelectionComplete = selectedImages.length === customerData.quantity
  const filteredCategories = getFilteredCategories()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header fixo */}
      <div className="sticky top-0 bg-white border-b z-20">
        <div className="max-w-4xl mx-auto">
          {/* Nav */}
          <div className="flex items-center justify-between p-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
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
          <div className="px-4 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Buscar categorias..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 pb-20">
        {filteredCategories.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {searchQuery ? "Nenhuma categoria encontrada para sua busca." : "Nenhuma categoria encontrada."}
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
