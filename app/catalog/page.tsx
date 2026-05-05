import { redirect } from "next/navigation"

/**
 * Rota legada. Hoje todo acesso ao catálogo passa por:
 *  - `/ver-catalogo` (modo visualização puro, aberto a todos)
 *  - `/fazer-pedido` (modo pedido, com `nome`/`pedido`/`quantidade` na query)
 *
 * Este server component preserva qualquer link antigo, bookmark ou
 * documentação que ainda aponte para `/catalog`, redirecionando para a
 * visualização (308 permanente). Acessos com query string também caem aqui
 * — é seguro descartar a query, pois o modo pedido agora exige passar
 * primeiro pela raiz `/`, que faz a transição correta.
 */
export default function CatalogLegacyPage() {
  redirect("/ver-catalogo")
}
