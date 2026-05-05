"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Unlink } from "lucide-react"
import CatalogView from "@/components/catalog/CatalogView"

type ValidationState =
  | { status: "loading" }
  | { status: "allowed" }
  | { status: "invalid"; reason?: string }

/**
 * Rota dedicada ao modo pedido do catálogo. Espera receber `nome`, `pedido`
 * e `quantidade` na query (formato gerado por `lib/order-links.ts`).
 *
 * Fluxo (preserva o que antes vivia em `app/page.tsx`):
 *  - Sem params válidos: volta para a landing (`/`).
 *  - Com params: consulta `POST /api/order-links/validate`.
 *    - `allowed`   → grava `customerData`, limpa carrinho de outro pedido se
 *                    houver, e renderiza o `CatalogView` em modo pedido.
 *    - `confirmed` → redireciona para `/confirmed/{pedido}`.
 *    - `invalid`   → renderiza inline a tela "URL Inválida".
 */
function FazerPedidoInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [state, setState] = useState<ValidationState>({ status: "loading" })

  useEffect(() => {
    const name = (searchParams.get("nome") ?? "").trim()
    const orderNumber = (searchParams.get("pedido") ?? "").trim()
    const quantityStr = (searchParams.get("quantidade") ?? "").trim()

    // Sem nenhum param: o cliente entrou direto, sem identificação. Mandamos
    // para a landing — fazer pedido sem identificação não faz sentido.
    if (!name && !orderNumber && !quantityStr) {
      router.replace("/")
      return
    }

    const quantity = Number.parseInt(quantityStr, 10)
    if (!name || !orderNumber || !Number.isInteger(quantity) || quantity <= 0) {
      setState({ status: "invalid", reason: "params" })
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/order-links/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, orderNumber, quantity }),
        })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return

        if (data.result === "allowed") {
          // Persistência por pedido (carrinho permanece entre acessos do mesmo link).
          const customerData = {
            name,
            orderNumber,
            quantity,
            timestamp: new Date().toISOString(),
          }
          try {
            const previousRaw = localStorage.getItem("customerData")
            const previous = previousRaw ? JSON.parse(previousRaw) : null
            if (previous && previous.orderNumber && previous.orderNumber !== orderNumber) {
              // Trocou de link: limpa carrinho e timer do pedido anterior.
              localStorage.removeItem(`selectedImages:${previous.orderNumber}`)
              localStorage.removeItem(`catalogTimer:${previous.orderNumber}`)
              localStorage.removeItem(`imageCache:${previous.orderNumber}`)
            }
          } catch {
            // localStorage indisponível: ignora.
          }
          localStorage.setItem("customerData", JSON.stringify(customerData))
          localStorage.setItem("sessionLocked", "true")
          setState({ status: "allowed" })
          return
        }

        if (data.result === "confirmed") {
          router.replace(`/confirmed/${encodeURIComponent(orderNumber)}`)
          return
        }

        setState({ status: "invalid", reason: data.reason })
      } catch (error) {
        console.error("Erro ao validar link:", error)
        if (!cancelled) {
          setState({ status: "invalid", reason: "network" })
        }
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  if (state.status === "invalid") {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            <div className="flex justify-center">
              <img src="/logo.png" alt="Logo" className="w-[150px]" />
            </div>
            <div className="flex justify-center">
              <Unlink className="w-12 h-12 text-red-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">URL Inválida</h1>
            <p className="text-sm text-gray-600">
              Esta URL não é válida ou não está mais disponível. Verifique o link
              recebido ou entre em contato com a Cenario.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (state.status === "allowed") {
    return <CatalogView mode="order" />
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-sm text-gray-600">Carregando...</p>
      </div>
    </div>
  )
}

export default function FazerPedidoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-sm text-gray-600">Carregando...</p>
          </div>
        </div>
      }
    >
      <FazerPedidoInner />
    </Suspense>
  )
}
