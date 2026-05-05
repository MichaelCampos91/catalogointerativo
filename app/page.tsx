"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Crown, Images, MessageCircle } from "lucide-react"
import { buildWhatsAppLink, WHATSAPP_NUMBERS } from "@/lib/whatsapp"

const MSG_ORCAMENTO = "Olá, gostaria de fazer um orçamento de painéis sublimados."
const MSG_GRUPO_VIP = "Olá, quero entrar no Grupo VIP para decoradores."
const INSTAGRAM_URL = "https://www.instagram.com/cenario.ff"

/**
 * Página raiz.
 *
 * Sem parâmetros → landing pública (acesso aberto a todos) com CTAs para
 * visualizar o catálogo, abrir conversa no WhatsApp (orçamento ou Grupo VIP)
 * e seguir a Cenario no Instagram.
 *
 * Com `nome`/`pedido`/`quantidade` → redireciona para `/fazer-pedido` com a
 * mesma query, preservando integralmente os links já enviados aos clientes.
 */
function HomeInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    const name = (searchParams.get("nome") ?? "").trim()
    const orderNumber = (searchParams.get("pedido") ?? "").trim()
    const quantityStr = (searchParams.get("quantidade") ?? "").trim()
    const quantity = Number.parseInt(quantityStr, 10)

    const hasAnyParam = !!(name || orderNumber || quantityStr)
    const hasValidPedidoParams =
      !!name && !!orderNumber && Number.isInteger(quantity) && quantity > 0

    if (!hasAnyParam) return

    // Se a query veio (mesmo parcial), o intuito é fazer pedido. Encaminha
    // para /fazer-pedido preservando a query original — a validação completa
    // (incluindo erro "URL Inválida" para params malformados) acontece lá.
    setRedirecting(true)
    const qs = searchParams.toString()
    router.replace(qs ? `/fazer-pedido?${qs}` : "/fazer-pedido")
  }, [searchParams, router])

  if (redirecting) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
          <p className="text-sm text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Logo fixa no topo */}
      <header className="shrink-0 bg-white border-b">
        <div className="max-w-lg mx-auto px-4 py-3 flex justify-center">
          <img src="/logo.png" alt="Cenario" className="w-[120px]" />
        </div>
      </header>

      {/* Conteúdo rolável */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-8 space-y-10">
          {/* Seção 1: Catálogo */}
          <section className="space-y-3 text-center">
            <h1 className="text-xl font-bold text-gray-900">
              Mini Painéis Redondos
            </h1>
            <p className="text-sm text-gray-600">
              Confira nosso catálogo de Mini Painéis Redondos 50cm
            </p>
            <Link
              href="/ver-catalogo"
              className="block w-full max-w-[350px] mx-auto"
            >
              <Button size="lg" className="w-full text-base font-medium uppercase">
                <Images className="w-4 h-4 mr-2" />
                Ver Catálogo
              </Button>
            </Link>
          </section>

          {/* Seção 2: Orçamento sublimados */}
          <section className="space-y-3 text-center">
            <h2 className="text-xl font-bold text-gray-900">
              Painéis e Pisos Sublimados Sob Medida
            </h2>
            <p className="text-sm text-gray-600">
              🇧🇷 Enviamos para todo o Brasil.
            </p>
            <a
              href={buildWhatsAppLink(MSG_ORCAMENTO, WHATSAPP_NUMBERS.orcamento)}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full max-w-[350px] mx-auto"
            >
              <Button size="lg" className="w-full text-base font-medium uppercase">
                <MessageCircle className="w-4 h-4 mr-2" />
                Orçamento por WhatsApp
              </Button>
            </a>
          </section>

          {/* Seção 3: Grupo VIP */}
          <section className="space-y-3 text-center">
            <h2 className="text-xl font-bold text-gray-900">
              Entre no Grupo VIP para Decoradores
            </h2>
            <p className="text-sm text-gray-600">
              Promoções Exclusivas e Queimas de Estoque todo os meses. 🔥
            </p>
            <a
              href={buildWhatsAppLink(MSG_GRUPO_VIP)}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full max-w-[350px] mx-auto"
            >
              <Button size="lg" className="w-full text-base font-medium uppercase">
                <Crown className="w-4 h-4 mr-2" />
                Quero entrar no Grupo VIP
              </Button>
            </a>
          </section>

          {/* Seção 4: Instagram */}
          <section className="space-y-3 text-center">
            <h2 className="text-xl font-bold text-gray-900">
              Siga a Cenario no Instagram
            </h2>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir perfil @cenario.ff no Instagram"
              className="block w-[70%] max-w-[300px] mx-auto"
            >
              <img
                src="/perfil-social.png"
                alt="Perfil @cenario.ff no Instagram"
                className="w-full rounded-2xl shadow-lg transition-transform duration-200 hover:scale-105"
                draggable={false}
              />
            </a>
          </section>
        </div>
      </main>

      {/* Rodapé fixo */}
      <footer className="shrink-0 bg-white border-t">
        <div className="max-w-lg mx-auto px-4 py-3 text-center text-xs text-gray-600 leading-relaxed">
          <p className="font-bold">Cenario | Birigui-SP</p>
          <p>42.480.518/0001-10</p>
        </div>
      </footer>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
            <p className="text-sm text-gray-600">Carregando...</p>
          </div>
        </div>
      }
    >
      <HomeInner />
    </Suspense>
  )
}
