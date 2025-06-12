"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ShoppingBag, User, Lock } from "lucide-react"
import { useRouter } from "next/navigation"
import { Suspense } from "react"
import { CustomerInitializer } from "@/components/CustomerInitializer"
import Image from "next/image"

export default function HomePage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/catalogointerativo'
  const [customerName, setCustomerName] = useState("")
  const [orderNumber, setOrderNumber] = useState("")
  const [quantity, setQuantity] = useState("")
  const [isLocked, setIsLocked] = useState(false)
  const [isFromUrl, setIsFromUrl] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleStart = async () => {
    try {
      setError(null)
      setIsLoading(true)
      
      // Validações mais detalhadas
      if (!customerName.trim()) {
        setError("Por favor, insira seu nome")
        setIsLoading(false)
        return
      }
      
      if (!orderNumber.trim()) {
        setError("Por favor, insira o número do pedido")
        setIsLoading(false)
        return
      }
      
      if (!quantity) {
        setError("Por favor, selecione a quantidade de produtos")
        setIsLoading(false)
        return
      }

      // Se vier via GET params, não precisa verificar isLocked
      if (!isFromUrl && isLocked) {
        setError("Sessão já iniciada. Por favor, aguarde.")
        setIsLoading(false)
        return
      }

      // Salvar dados no localStorage
      const customerData = {
        name: customerName.trim(),
        orderNumber: orderNumber.trim(),
        quantity: Number.parseInt(quantity),
        timestamp: new Date().toISOString()
      }

      localStorage.setItem("customerData", JSON.stringify(customerData))
      localStorage.setItem("sessionLocked", "true")
      
      // Navegar para o catálogo
      await router.push("/catalog")
    } catch (err) {
      setError("Ocorreu um erro ao iniciar a sessão. Por favor, tente novamente.")
      console.error("Erro ao iniciar sessão:", err)
      setIsLoading(false)
    }
  }

  const appName = process.env.NEXT_PUBLIC_APP_NAME || "Catálogo Interativo"
  const isFormValid = Boolean(customerName && orderNumber && quantity)

  return (
    <Suspense fallback={null}>
      <CustomerInitializer
        onLoad={(data) => {
          setCustomerName(data.name)
          setOrderNumber(data.orderNumber)
          setQuantity(data.quantity.toString())
          setIsLocked(true)
          setIsFromUrl(data.isFromUrl)
        }}
      />

      <div className="min-h-screen bg-gray-100">
        <div className="max-w-md mx-auto pt-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Image className="w-[120px]" src="https://cdn.dooca.store/142264/files/logo-cenario-2024-colorida-fundo-transparente.png?v=1700832681" alt="Logo"/>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Catalogo Cenario</h1>
            <p className="text-gray-600">Selecione os temas no nosso catálogo:</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Informações Iniciais
                {isLocked && <Lock className="w-4 h-4 text-gray-400" />}
              </CardTitle>
              <CardDescription>
                {isLocked
                  ? "Informações carregadas automaticamente"
                  : "Preencha seus dados para acessar o catálogo"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Seu nome</Label>
                <Input
                  id="name"
                  placeholder="Digite seu nome completo"
                  value={customerName}
                  onChange={(e) => !isLocked && setCustomerName(e.target.value)}
                  disabled={isLocked}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="orderNumber">Número do Pedido</Label>
                <Input
                  id="orderNumber"
                  placeholder="Digite o número do pedido"
                  value={orderNumber}
                  onChange={(e) => !isLocked && setOrderNumber(e.target.value)}
                  disabled={isLocked}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantos produtos você comprou?</Label>
                <Select
                  value={quantity}
                  onValueChange={(value) => !isLocked && setQuantity(value)}
                  disabled={isLocked}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a quantidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num} {num === 1 ? "produto" : "produtos"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleStart}
                disabled={!isFormValid || isLoading}
                className="w-full"
                size="lg"
              >
                {isLoading ? "Aguarde..." : "Acessar Catálogo"}
              </Button>

              {error && (
                <p className="text-sm text-red-500 mt-2">{error}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Suspense>
  )
}
