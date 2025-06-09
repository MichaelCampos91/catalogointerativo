"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ShoppingBag, User, Lock } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { CustomerInitializer } from "@/components/CustomerInitializer"

export default function HomePage() {
  const [customerName, setCustomerName] = useState("")
  const [orderNumber, setOrderNumber] = useState("")
  const [quantity, setQuantity] = useState("")
  const [isLocked, setIsLocked] = useState(false)
  const [isFromUrl, setIsFromUrl] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Verificar parâmetros GET primeiro
    const name = searchParams.get("nome")
    const order = searchParams.get("pedido")
    const qty = searchParams.get("quantidade")

    if (name && order && qty) {
      setCustomerName(name)
      setOrderNumber(order)
      setQuantity(qty)
      setIsLocked(true)
      setIsFromUrl(true)

      // Salvar dados e bloquear edição
      const customerData = {
        name,
        orderNumber: order,
        quantity: Number.parseInt(qty),
      }
      localStorage.setItem("customerData", JSON.stringify(customerData))
      localStorage.setItem("sessionLocked", "true")
      return
    }

    // Se não vier da URL, verificar se já existe uma sessão bloqueada
    const isSessionLocked = localStorage.getItem("sessionLocked") === "true"
    if (isSessionLocked) {
      const savedData = localStorage.getItem("customerData")
      if (savedData) {
        const data = JSON.parse(savedData)
        setCustomerName(data.name)
        setOrderNumber(data.orderNumber)
        setQuantity(data.quantity.toString())
        setIsLocked(true)
      }
    }
  }, [searchParams])

  const handleStart = () => {
    if (customerName && orderNumber && quantity) {
      // Salvar dados no localStorage para usar no catálogo
      localStorage.setItem(
        "customerData",
        JSON.stringify({
          name: customerName,
          orderNumber,
          quantity: Number.parseInt(quantity),
        }),
      )
      localStorage.setItem("sessionLocked", "true")
      router.push("/catalog")
    }
  }

  // Usar variável de ambiente pública para o nome da aplicação
  const appName = process.env.NEXT_PUBLIC_APP_NAME || "Catálogo Interativo"

  // Verificar se todos os campos necessários estão preenchidos
  const isFormValid = Boolean(customerName && orderNumber && quantity)

  return (

    <Suspense fallback={null}>
      <CustomerInitializer onLoad={(data) => {
        setCustomerName(data.name)
        setOrderNumber(data.orderNumber)
        setQuantity(data.quantity.toString())
        setIsLocked(true)
        setIsFromUrl(data.isFromUrl)
      }} />
    
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-md mx-auto pt-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{appName}</h1>
            <p className="text-gray-600">Selecione os temas no nosso catálogo</p>
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
                disabled={!isFormValid || (isLocked && !isFromUrl)} 
                className="w-full" 
                size="lg"
              >
                Acessar Catálogo
              </Button>
            </CardContent>
          </Card>

          <div className="mt-8 text-center space-y-2">
            <Button variant="link" onClick={() => router.push("/admin")}>
              Área Administrativa
            </Button>
          </div>
        </div>
      </div>
    </Suspense>
  )
}
