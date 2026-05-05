"use client"

import CatalogView from "@/components/catalog/CatalogView"

/**
 * Catálogo em modo visualização puro. Aberto a qualquer cliente — inclusive
 * quem tem um pedido em andamento (`customerData` no localStorage). Nesta
 * rota o `CatalogView` ignora o `customerData`, então não há seleção,
 * cronômetro, validação em background ou botão de confirmar.
 */
export default function VerCatalogoPage() {
  return <CatalogView mode="view" />
}
