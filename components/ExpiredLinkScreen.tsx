"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Clock } from "lucide-react"
import { LINK_EXPIRATION_DEFAULT_MESSAGE } from "@/lib/link-expiration-constants"

type ExpiredLinkScreenProps = {
  message?: string | null
}

/**
 * Tela exibida quando o cliente tenta acessar (ou permanece em) um link de
 * pedido cujo prazo de expiração já passou. Mesmo padrão visual da tela
 * "URL Inválida".
 */
export function ExpiredLinkScreen({ message }: ExpiredLinkScreenProps) {
  const text =
    typeof message === "string" && message.trim()
      ? message.trim()
      : LINK_EXPIRATION_DEFAULT_MESSAGE

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center space-y-4">
          <div className="flex justify-center">
            <img src="/logo.png" alt="Logo" className="w-[150px]" />
          </div>
          <div className="flex justify-center">
            <Clock className="w-12 h-12 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Link Expirado</h1>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{text}</p>
        </CardContent>
      </Card>
    </div>
  )
}
