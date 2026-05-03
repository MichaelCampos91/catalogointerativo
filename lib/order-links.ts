/**
 * Constrói a URL pública que o cliente recebe para entrar em modo de pedido.
 *
 * Mantém o formato histórico `/?nome=X&pedido=Y&quantidade=Z` para preservar
 * compatibilidade com mensagens já enviadas. A raiz `/` faz a validação contra
 * `order_links` e redireciona para `/catalog`, `/confirmed/{Y}` ou exibe a tela
 * "URL Inválida".
 *
 * Sempre usa apenas o `origin` (protocolo + host) da base, descartando qualquer
 * pathname (ex.: `/catalogointerativo`) — o app é servido na raiz do domínio
 * público mesmo quando hospedado por trás de um sub-path.
 */
export function buildClientOrderLink(params: {
  name: string
  orderNumber: string
  quantity: number
  /** Origem da request (header `Origin`) usada como fallback se NEXT_PUBLIC_BASE_URL não estiver definido. */
  origin?: string | null
}): string {
  const { name, orderNumber, quantity, origin } = params
  const rawBase =
    (process.env.NEXT_PUBLIC_BASE_URL && process.env.NEXT_PUBLIC_BASE_URL.trim()) ||
    (origin && origin.trim()) ||
    ""
  const trimmedBase = extractOrigin(rawBase)
  const query = new URLSearchParams({
    nome: name,
    pedido: orderNumber,
    quantidade: String(quantity),
  })
  return `${trimmedBase}/?${query.toString()}`
}

/**
 * Extrai apenas a origem (protocolo + host[:porta]) de uma URL,
 * tolerando entradas sem schema. Em caso de parse falhar, devolve uma versão
 * trimada do input original.
 */
function extractOrigin(value: string): string {
  if (!value) return ""
  try {
    const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`
    return new URL(candidate).origin
  } catch {
    return value.replace(/\/+$/, "")
  }
}
