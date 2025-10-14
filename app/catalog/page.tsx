"use client"

import { useEffect, useState, useRef } from "react"
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
import { toast } from "sonner"

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
  const [loading, setLoading] = useState(false)
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
  const [imagesCache, setImagesCache] = useState<Record<string, { code: string; image_url: string; category_id: string }>>({})
  const router = useRouter()

  useEffect(() => {
    const data = localStorage.getItem("customerData")
    if (data) {
      const parsed = JSON.parse(data)
      setCustomerData(parsed)
      // Limpar caches de pedidos diferentes e carregar cache do pedido atual
      const currentCacheKey = `imageCache:${parsed.orderNumber}`
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith("imageCache:") && k !== currentCacheKey) {
          keysToRemove.push(k)
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k))
      const cached = localStorage.getItem(currentCacheKey)
      if (cached) {
        try { setImagesCache(JSON.parse(cached)) } catch {}
      }
    }
  
    // Carregar itens selecionados do localStorage
    const savedSelectedImages = localStorage.getItem("selectedImages")
    if (savedSelectedImages) {
      setSelectedImages(JSON.parse(savedSelectedImages))
    }

    loadCatalogData()

    // Inicializar o cronômetro apenas se houver dados do cliente
    if (data) {
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
    }
  }, [])

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

  // Efeito para salvar itens selecionados no localStorage
  useEffect(() => {
    if (customerData && selectedImages.length > 0) {
      localStorage.setItem("selectedImages", JSON.stringify(selectedImages))
    } else if (!customerData) {
      localStorage.removeItem("selectedImages")
    }
  }, [selectedImages, customerData])

  // Prefetch de itens ausentes no cache ao abrir o modal
  useEffect(() => {
    const prefetchMissing = async () => {
      if (!showConfirmDialog || !customerData) return
      const missing = selectedImages.filter((code) => !imagesCache[code])
      if (missing.length === 0) return
      try {
        const res = await fetch(`/api/files?all=true&limit=9999&page=1`)
        if (!res.ok) return
        const j = await res.json()
        const fetched: Record<string, { code: string; image_url: string; category_id: string }> = {}
        // Tentar resolver pelos arrays "images" (diretório atual)
        if (Array.isArray(j.images)) {
          for (const img of j.images) {
            if (missing.includes(img.code)) {
              fetched[img.code] = { code: img.code, image_url: img.url, category_id: img.category || '' }
            }
          }
        }
        // Tentar resolver pelos arrays aninhados em categorias
        if (Array.isArray(j.categories)) {
          for (const cat of j.categories) {
            if (Array.isArray(cat.images)) {
              for (const img of cat.images) {
                if (missing.includes(img.code)) {
                  fetched[img.code] = { code: img.code, image_url: img.url, category_id: cat.id || cat.name }
                }
              }
            }
          }
        }
        if (Object.keys(fetched).length > 0) {
          setImagesCache((prev) => {
            const merged = { ...prev, ...fetched }
            const codes = Object.keys(merged)
            if (codes.length > 200) {
              const prioritized = new Set<string>(selectedImages)
              const result: Record<string, { code: string; image_url: string; category_id: string }> = {}
              for (const code of codes) {
                if (prioritized.has(code)) result[code] = merged[code]
              }
              for (const code of codes) {
                if (!result[code]) {
                  result[code] = merged[code]
                  if (Object.keys(result).length >= 200) break
                }
              }
              try { localStorage.setItem(`imageCache:${customerData.orderNumber}`, JSON.stringify(result)) } catch {}
              return result
            }
            try { localStorage.setItem(`imageCache:${customerData.orderNumber}`, JSON.stringify(merged)) } catch {}
            return merged
          })
        }
      } catch {}
    }
    prefetchMissing()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showConfirmDialog])

  // Função para formatar o tempo restante
  const formatTimeLeft = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  // Função para carregar dados do catálogo
  const loadCatalogData = async (page = 1, search = "") => {
    try {
      setError(null)
      if (page === 1) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }

      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
      })
      if (search) {
        queryParams.append('search', search)
      }

      // Chamar novo endpoint dinâmico
      const response = await fetch(`/api/files?${queryParams.toString()}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Erro ao carregar catálogo: ${errorData.message || response.status}`)
      }
      const data = await response.json()

      // DEBUG: Exibir o termo buscado e o resultado retornado
      // console.log('[CATALOG SEARCH] Termo buscado:', search)
      // console.log('[CATALOG SEARCH] Categorias retornadas:', data.categories)
      // console.log('[CATALOG SEARCH] Imagens retornadas:', data.categories.flatMap((cat: any) => cat.images))

      // Adaptar para novo formato
      const newCategories = data.categories.map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
      }))
      const newImages = data.categories.flatMap((cat: any) =>
        cat.images.map((img: any) => ({
          id: img.code,
          code: img.code,
          category_id: cat.id,
          image_url: img.url,
          thumbnail_url: null,
        }))
      )
      if (page === 1) {
        setCategories(newCategories)
        setImages(newImages)
      } else {
        setCategories((prev) => [...prev, ...newCategories])
        setImages((prev) => [...prev, ...newImages])
      }
      setPagination(data.pagination)
      // Atualizar cache de imagens vistas e persistir por pedido (cap 200)
      if (customerData) {
        setImagesCache((prev) => {
          const updated: Record<string, { code: string; image_url: string; category_id: string }> = { ...prev }
          for (const img of newImages) {
            updated[img.code] = { code: img.code, image_url: img.image_url, category_id: img.category_id }
          }
          const codes = Object.keys(updated)
          if (codes.length > 200) {
            const prioritized = new Set<string>(selectedImages)
            const result: Record<string, { code: string; image_url: string; category_id: string }> = {}
            for (const code of codes) {
              if (prioritized.has(code)) {
                result[code] = updated[code]
              }
            }
            for (const code of codes) {
              if (!result[code]) {
                result[code] = updated[code]
                if (Object.keys(result).length >= 200) break
              }
            }
            try { localStorage.setItem(`imageCache:${customerData.orderNumber}`, JSON.stringify(result)) } catch {}
            return result
          }
          try { localStorage.setItem(`imageCache:${customerData.orderNumber}`, JSON.stringify(updated)) } catch {}
          return updated
        })
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error)
      setError(error instanceof Error ? error.message : "Erro desconhecido ao carregar dados")
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  // Debounce para busca
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current)
    }
    debounceTimeout.current = setTimeout(() => {
      loadCatalogData(1, searchQuery)
    }, 600)
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])

  // Atualizar scroll para paginação
  const loadMore = () => {
    if (pagination.page < pagination.totalPages && !loadingMore) {
      loadCatalogData(pagination.page + 1, searchQuery)
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
    if (!customerData) return // Não permite seleção no modo de visualização

    if (selectedImages.includes(imageCode)) {
      setSelectedImages((prev) => prev.filter((code) => code !== imageCode))
    } else if (selectedImages.length < customerData.quantity) {
      setSelectedImages((prev) => [...prev, imageCode])
    }
  }

  const handleConfirmOrder = async () => {
    if (!customerData || !isAware) return

    try {
      setLoading(true)
      setError(null)

      const message = `Olá! Meu nome é *${customerData.name}* e esses são os temas que escolhi do catálogo:\n\n${selectedImages.map((code) => `*${code}*`).join("\n")} \n Nº do pedido: *${customerData.orderNumber}*`

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
        throw new Error(errorData.message || "Erro ao salvar pedido")
      }

      // Limpar localStorage
      localStorage.removeItem("customerData")
      localStorage.removeItem("sessionLocked")
      localStorage.removeItem("selectedImages")
      localStorage.removeItem("catalogTimer")
      if (customerData?.orderNumber) {
        localStorage.removeItem(`imageCache:${customerData.orderNumber}`)
      }
 
      // Limpar estado local
      setCustomerData(null)
      setSelectedImages([])
      setTimeLeft(0)
      setImagesCache({})

      toast.success("Seu pedido foi confirmado! Conheça outros produtos em nossa loja...")
      
      // Fechar o modal
      setShowConfirmDialog(false)
      setIsAware(false)

      // Redirecionar para a página de confirmação
      router.push(`/confirmed/${customerData.orderNumber}`)
    } catch (error) {
      console.error("Erro ao salvar pedido:", error)
      setError(error instanceof Error ? error.message : "Erro ao salvar pedido")
      toast.error(error instanceof Error ? error.message : "Erro ao salvar pedido")
    } finally {
      setLoading(false)
    }
  }

  const getImagesByCategory = (categoryId: string) => {
    return images.filter((img) => img.category_id === categoryId)
  }

  // Função para filtrar categorias baseado na busca (agora só filtra localmente se searchQuery vazio)
  const getFilteredCategories = () => {
    if (!searchQuery.trim()) return categories
    // Se searchQuery existe, categorias já vêm filtradas do backend
    return categories
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

  const isSelectionComplete = customerData ? selectedImages.length === customerData.quantity : false
  const filteredCategories = getFilteredCategories()

  return (
    <div className="min-h-screen bg-gray-50 overflow-hidden">
      {/* Header fixo */}
      <div className="sticky top-0 bg-white border-b z-20">
        <div className="max-w-4xl mx-auto">
          {/* Nav */}
          <div className="flex items-center justify-between p-4">
            
            <img className="w-[120px]" src="/logo.png" alt="Logo"/>
            
            <div className="text-center">
              {customerData ? (
                <>
                  <p className="font-medium">Olá, {customerData.name}!</p>
                  <Badge variant={isSelectionComplete ? "default" : "secondary"}>
                    {selectedImages.length}/{customerData.quantity} selecionadas
                  </Badge>
                </>
              ) : (
                <p className="font-medium">Modo de Visualização</p>
              )}
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

          {/* Cronômetro - apenas se houver dados do cliente */}
          {customerData && (
            <div className="px-4 pb-4 text-center">
              <p className="text-sm text-gray-600">
                Você tem <span className="font-bold text-indigo-600">{formatTimeLeft(timeLeft)} hrs</span> para finalizar a seleção.
              </p>
            </div>
          )}
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
                        const isDisabled = !isSelected && selectedImages.length >= (customerData?.quantity ?? 0)

                        return (
                          <Card
                            key={image.id}
                            className={`relative transition-all flex-shrink-0 w-[200px] ${
                              isSelected ? "ring-2 ring-indigo-500" : ""
                            } ${!customerData ? "cursor-default" : isDisabled ? "opacity-50" : "cursor-pointer hover:shadow-md"}`}
                            onClick={() => customerData && !isDisabled && handleImageSelect(image.code)}
                          >
                            <CardContent className="p-0">
                              <div className="relative aspect-square">
                                <img
                                  src={image.image_url}
                                  alt={image.code}
                                  className="object-cover w-full h-full"
                                  onContextMenu={(e) => e.preventDefault()}
                                  draggable="false"
                                  style={{ userSelect: 'none' }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <img 
                                    src="/logo.png" 
                                    alt="Logo" 
                                    className="w-24 opacity-40"
                                  />
                                </div>
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
          <DialogContent className="w-[95vw] sm:w-auto sm:max-w-lg md:max-w-2xl lg:max-w-3xl xl:max-w-4xl max-w-full overflow-hidden p-0">
            <div className="flex flex-col max-h-[80vh] sm:max-h-[85vh]">
              <DialogHeader className="px-4 pt-4 pb-2">
                <div className="flex justify-center mb-3">
                  <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-500" />
                </div>
                <DialogTitle className="text-center text-lg sm:text-xl">Confirmar Pedido</DialogTitle>
                <DialogDescription className="text-center text-sm sm:text-base">
                  Você está prestes a confirmar seu pedido com {selectedImages.length} imagens selecionadas.
                </DialogDescription>
              </DialogHeader>

              {/* ÁREA ROLÁVEL */}
              <div className="flex-1 overflow-hidden px-4 pb-4 space-y-4">
                <h4 className="text-sm font-medium text-gray-700 text-center">
                  Imagens Selecionadas ({selectedImages.length}/{customerData?.quantity})
                </h4>
                {/* MINIATURAS (GRID COM ROLAGEM VERTICAL) */}
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[50vh] overflow-y-auto px-4 pt-4 pb-32">
                  {selectedImages.map((imageCode) => {
                    const cached = imagesCache[imageCode]
                    const url = cached?.image_url
                    return (
                      <div key={imageCode} className="relative">
                        <div className="w-full aspect-square rounded-lg overflow-hidden border-2 border-gray-200 relative bg-gray-100">
                          {url ? (
                            <img
                              src={url}
                              alt={imageCode}
                              className="w-full h-full object-cover select-none"
                              onContextMenu={(e) => e.preventDefault()}
                              draggable={false}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500 p-2 text-center text-xs">
                              {imageCode}
                            </div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <img src="/logo.png" alt="Logo" className="w-10 sm:w-12 opacity-40" />
                          </div>
                        </div>

                        {/* Botão de remover não ultrapassa o card */}
                        <button
                          onClick={() => handleImageSelect(imageCode)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-md"
                          title="Remover imagem"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>

                        <p className="text-[11px] sm:text-xs text-center mt-1 font-medium text-gray-600 truncate" title={imageCode}>{imageCode}</p>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* FOOTER FIXO */}
              <div className="sticky bottom-0 w-full bg-white border-t p-3 sm:p-4">
                <div className="flex items-start sm:items-center gap-3 px-1 sm:px-2 mb-2">
                  <Checkbox
                    id="aware"
                    checked={isAware}
                    onCheckedChange={(checked) => setIsAware(checked as boolean)}
                  />
                  <label htmlFor="aware" className="text-sm sm:text-base font-medium leading-snug sm:leading-none">
                    Estou ciente que <strong>NÃO PODEREI ALTERAR</strong> os itens selecionados após a confirmação
                  </label>
                </div>
                <Button
                  onClick={handleConfirmOrder}
                  disabled={!isAware || loading || !isSelectionComplete}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processando...
                    </>
                  ) : (
                    "Confirmar Pedido"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>


        {/* Botão de WhatsApp */}
        {customerData && selectedImages.length > 0 && (
          <div className="fixed bottom-4 left-0 right-0 flex justify-center">
            <Button
              size="lg"
              className="shadow-lg"
              onClick={() => setShowConfirmDialog(true)}
              disabled={!isSelectionComplete || loading}
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
