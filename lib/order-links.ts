/**
 * Constrói a URL pública que o cliente recebe para entrar em modo de pedido.
 *
 * Mantém o formato histórico `/?nome=X&pedido=Y&quantidade=Z` para preservar
 * compatibilidade com mensagens já enviadas. A raiz `/` faz a validação contra
 * `order_links` e redireciona para `/catalog`, `/confirmed/{Y}` ou exibe a tela
 * "URL Inválida".
 */
export function buildClientOrderLink(params: {
  name: string
  orderNumber: string
  quantity: number
  /** Origem da request (header `Origin`) usada como fallback se NEXT_PUBLIC_BASE_URL não estiver definido. */
  origin?: string | null
}): string {
  const { name, orderNumber, quantity, origin } = params
  const base =
    (process.env.NEXT_PUBLIC_BASE_URL && process.env.NEXT_PUBLIC_BASE_URL.trim()) ||
    (origin && origin.trim()) ||
    ""
  const trimmedBase = base.replace(/\/+$/, "")
  const query = new URLSearchParams({
    nome: name,
    pedido: orderNumber,
    quantidade: String(quantity),
  })
  return `${trimmedBase}/?${query.toString()}`
}
