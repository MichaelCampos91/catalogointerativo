"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Copy, Link2, Search, CheckCircle2, Save, MessageSquare, Settings } from "lucide-react"
import { useToast } from "@/hooks/use-sonner-toast"

type OrderLink = {
  id: string
  customer_name: string
  order_number: string
  quantity: number
  message: string | null
  message_template: string | null
  generated_url: string
  status: "pending" | "confirmed"
  created_at: string
  updated_at: string
  confirmed_at: string | null
  order_id: string | null
}

const PAGE_SIZE = 20
const STATUS_OPTIONS: { key: "pending" | "confirmed"; label: string }[] = [
  { key: "pending", label: "Pendentes" },
  { key: "confirmed", label: "Confirmados" },
]
const PLACEHOLDER_TOKEN = "{{link gerado}}"

function buildPreviewUrl(name: string, orderNumber: string, quantity: string): string {
  const trimmedName = name.trim()
  const trimmedOrder = orderNumber.trim()
  const qtyNumber = Number.parseInt(quantity, 10)
  if (!trimmedName || !trimmedOrder || !Number.isInteger(qtyNumber) || qtyNumber <= 0) {
    return ""
  }
  const base =
    (process.env.NEXT_PUBLIC_BASE_URL && process.env.NEXT_PUBLIC_BASE_URL.trim()) ||
    (typeof window !== "undefined" ? window.location.origin : "")
  const trimmedBase = base.replace(/\/+$/, "")
  const query = new URLSearchParams({
    nome: trimmedName,
    pedido: trimmedOrder,
    quantidade: String(qtyNumber),
  })
  return `${trimmedBase}/?${query.toString()}`
}

function formatDate(dateString: string | null) {
  if (!dateString) return "—"
  return new Date(dateString).toLocaleString("pt-BR")
}

export default function AdminLinksPage() {
  const toast = useToast()

  // Form state
  const [customerName, setCustomerName] = useState("")
  const [orderNumber, setOrderNumber] = useState("")
  const [quantity, setQuantity] = useState("")
  const [messageTemplate, setMessageTemplate] = useState("")
  const [registering, setRegistering] = useState(false)

  // Default template
  const [defaultTemplate, setDefaultTemplate] = useState("")
  const [defaultTemplateLoading, setDefaultTemplateLoading] = useState(true)
  const [savingTemplate, setSavingTemplate] = useState(false)

  // Success modal
  const [successOpen, setSuccessOpen] = useState(false)
  const [createdLink, setCreatedLink] = useState<OrderLink | null>(null)

  // Modais do topo
  const [messageModalOpen, setMessageModalOpen] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)

  // Configurações de acesso
  type AccessSettings = {
    catalog_access_restricted: boolean
    auto_register_links_on_confirm: boolean
  }
  const [accessSettings, setAccessSettings] = useState<AccessSettings>({
    catalog_access_restricted: true,
    auto_register_links_on_confirm: false,
  })
  const [accessSettingsDraft, setAccessSettingsDraft] = useState<AccessSettings>({
    catalog_access_restricted: true,
    auto_register_links_on_confirm: false,
  })
  const [accessSettingsLoading, setAccessSettingsLoading] = useState(true)
  const [savingAccessSettings, setSavingAccessSettings] = useState(false)

  // Filters / list
  const [statusFilters, setStatusFilters] = useState<Record<"pending" | "confirmed", boolean>>({
    pending: true,
    confirmed: true,
  })
  const [periodFromDraft, setPeriodFromDraft] = useState("")
  const [periodToDraft, setPeriodToDraft] = useState("")
  const [periodFieldDraft, setPeriodFieldDraft] = useState<"created" | "confirmed">("created")
  const [periodFromApplied, setPeriodFromApplied] = useState("")
  const [periodToApplied, setPeriodToApplied] = useState("")
  const [periodFieldApplied, setPeriodFieldApplied] = useState<"created" | "confirmed">("created")
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [links, setLinks] = useState<OrderLink[]>([])
  const [total, setTotal] = useState(0)
  const [loadingList, setLoadingList] = useState(true)

  // Carregar template padrão na entrada da página
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/settings/link-message", { credentials: "include" })
        if (!res.ok) throw new Error("Falha ao carregar template padrão")
        const data = await res.json()
        if (cancelled) return
        const tpl = typeof data.template === "string" ? data.template : ""
        setDefaultTemplate(tpl)
        setMessageTemplate(tpl)
      } catch (err) {
        console.error(err)
      } finally {
        if (!cancelled) setDefaultTemplateLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Carregar configurações de acesso na entrada da página
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/settings/access-control", { credentials: "include" })
        if (!res.ok) throw new Error("Falha ao carregar configurações de acesso")
        const data = (await res.json()) as AccessSettings
        if (cancelled) return
        const normalized: AccessSettings = {
          catalog_access_restricted: !!data.catalog_access_restricted,
          auto_register_links_on_confirm: !!data.auto_register_links_on_confirm,
        }
        setAccessSettings(normalized)
        setAccessSettingsDraft(normalized)
      } catch (err) {
        console.error(err)
      } finally {
        if (!cancelled) setAccessSettingsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Sincroniza o draft com o estado salvo sempre que o modal de configurações abrir.
  useEffect(() => {
    if (settingsModalOpen) {
      setAccessSettingsDraft(accessSettings)
    }
  }, [settingsModalOpen, accessSettings])

  const loadLinks = async (pageNum = page) => {
    try {
      setLoadingList(true)
      const params = new URLSearchParams()
      const activeStatuses = STATUS_OPTIONS.filter((o) => statusFilters[o.key]).map((o) => o.key)
      activeStatuses.forEach((s) => params.append("status", s))
      if (periodFromApplied) params.set("periodFrom", periodFromApplied)
      if (periodToApplied) params.set("periodTo", periodToApplied)
      if (periodFromApplied || periodToApplied) params.set("periodField", periodFieldApplied)
      if (searchQuery.trim()) params.set("search", searchQuery.trim())
      params.set("page", String(pageNum))
      params.set("pageSize", String(PAGE_SIZE))

      const res = await fetch(`/api/order-links?${params.toString()}`, { credentials: "include" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || err.error || "Falha ao listar links")
      }
      const data = await res.json()
      setLinks(data.links || [])
      setTotal(data.total ?? 0)
      setPage(data.page ?? pageNum)
    } catch (err) {
      console.error(err)
      toast.error({
        title: "Erro ao listar links",
        description: err instanceof Error ? err.message : "Erro desconhecido",
      })
    } finally {
      setLoadingList(false)
    }
  }

  // Recarregar listagem ao mudar filtros aplicados, status ou página
  useEffect(() => {
    loadLinks(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilters, periodFromApplied, periodToApplied, periodFieldApplied, searchQuery, page])

  // URL gerada (preview em tempo real)
  const previewUrl = useMemo(
    () => buildPreviewUrl(customerName, orderNumber, quantity),
    [customerName, orderNumber, quantity],
  )

  // Mensagem renderizada (substitui {{link gerado}} pelo previewUrl)
  const renderedMessage = useMemo(() => {
    if (!previewUrl) return messageTemplate
    return messageTemplate.replace(/{{\s*link gerado\s*}}/gi, previewUrl)
  }, [messageTemplate, previewUrl])

  const isFormValid = useMemo(() => {
    const qtyNumber = Number.parseInt(quantity, 10)
    return (
      customerName.trim() !== "" &&
      orderNumber.trim() !== "" &&
      Number.isInteger(qtyNumber) &&
      qtyNumber > 0 &&
      qtyNumber <= 999
    )
  }, [customerName, orderNumber, quantity])

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success({ title: "Copiado", description: `${label} copiado para a área de transferência` })
    } catch {
      toast.error({ title: "Erro ao copiar", description: "Não foi possível copiar o texto" })
    }
  }

  const handleSaveDefaultTemplate = async () => {
    try {
      setSavingTemplate(true)
      const res = await fetch("/api/settings/link-message", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ template: defaultTemplate }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || err.error || "Falha ao salvar template")
      }
      toast.success({ title: "Template salvo", description: "O template padrão foi atualizado." })
      setMessageModalOpen(false)
    } catch (err) {
      toast.error({
        title: "Erro ao salvar template",
        description: err instanceof Error ? err.message : "Erro desconhecido",
      })
    } finally {
      setSavingTemplate(false)
    }
  }

  const handleSaveAccessSettings = async () => {
    try {
      setSavingAccessSettings(true)
      // Coerência local antes de enviar (o backend também aplica essa regra).
      const payload: AccessSettings = {
        catalog_access_restricted: accessSettingsDraft.catalog_access_restricted,
        auto_register_links_on_confirm: accessSettingsDraft.catalog_access_restricted
          ? false
          : accessSettingsDraft.auto_register_links_on_confirm,
      }
      const res = await fetch("/api/settings/access-control", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || err.error || "Falha ao salvar configurações")
      }
      const saved = (await res.json()) as AccessSettings
      const normalized: AccessSettings = {
        catalog_access_restricted: !!saved.catalog_access_restricted,
        auto_register_links_on_confirm: !!saved.auto_register_links_on_confirm,
      }
      setAccessSettings(normalized)
      setAccessSettingsDraft(normalized)
      toast.success({
        title: "Configurações salvas",
        description: "As preferências de acesso foram atualizadas.",
      })
      setSettingsModalOpen(false)
    } catch (err) {
      toast.error({
        title: "Erro ao salvar configurações",
        description: err instanceof Error ? err.message : "Erro desconhecido",
      })
    } finally {
      setSavingAccessSettings(false)
    }
  }

  const handleRegisterLink = async () => {
    if (!isFormValid) return
    try {
      setRegistering(true)
      const res = await fetch("/api/order-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          customer_name: customerName.trim(),
          order_number: orderNumber.trim(),
          quantity: Number.parseInt(quantity, 10),
          message_template: messageTemplate,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || data.message || "Erro ao registrar link")
      }
      const link: OrderLink = data.link
      setCreatedLink(link)
      setSuccessOpen(true)
      toast.success({ title: "Link registrado", description: "O link foi registrado com sucesso." })
      // Limpar form (mantém o template padrão para próximo registro)
      setCustomerName("")
      setOrderNumber("")
      setQuantity("")
      setMessageTemplate(defaultTemplate)
      // Recarregar lista (volta para página 1 para enxergar o novo)
      setPage(1)
      await loadLinks(1)
    } catch (err) {
      toast.error({
        title: "Erro ao registrar link",
        description: err instanceof Error ? err.message : "Erro desconhecido",
      })
    } finally {
      setRegistering(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="max-w-6xl mx-auto w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Links de Pedidos</h1>
          <p className="text-gray-600">Gere e gerencie os links que liberam o cliente a fazer um pedido no catálogo.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setMessageModalOpen(true)}>
            <MessageSquare className="w-4 h-4 mr-2" />
            Mensagem padrão
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSettingsModalOpen(true)}
            aria-label="Configurações de acesso"
            title="Configurações de acesso"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Novo link */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Novo link</CardTitle>
          <CardDescription>Preencha os dados do pedido da Shopee para gerar o link do cliente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="customerName">Nome (username Shopee)</Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ex.: maria_silva"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orderNumber">Número do pedido</Label>
              <Input
                id="orderNumber"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="Ex.: 2402151ABCXYZ"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantidade de itens</Label>
              <Input
                id="quantity"
                type="number"
                inputMode="numeric"
                min={1}
                max={999}
                step={1}
                maxLength={3}
                value={quantity}
                onChange={(e) => {
                  // Limita a 3 caracteres numéricos
                  const onlyDigits = e.target.value.replace(/\D/g, "").slice(0, 3)
                  setQuantity(onlyDigits)
                }}
                placeholder="Ex.: 10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="generatedUrl">Link gerado (preenchido automaticamente)</Label>
            <div className="flex gap-2">
              <Input id="generatedUrl" value={previewUrl} readOnly placeholder="O link será exibido aqui" />
              <Button
                type="button"
                variant="outline"
                disabled={!previewUrl}
                onClick={() => copyToClipboard(previewUrl, "Link")}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="messageTemplate">Mensagem</Label>
            <Textarea
              id="messageTemplate"
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              rows={5}
              placeholder={`Use ${PLACEHOLDER_TOKEN} para indicar onde o link deve aparecer.`}
            />
            {previewUrl && (
              <div className="rounded-md border bg-gray-50 p-3 text-sm">
                <p className="text-xs text-gray-500 mb-2">Pré-visualização da mensagem:</p>
                <pre className="whitespace-pre-wrap break-words font-sans text-gray-800">{renderedMessage}</pre>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleRegisterLink} disabled={!isFormValid || registering}>
              <Link2 className="w-4 h-4 mr-2" />
              {registering ? "Registrando..." : "Registrar Link"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Linha 1: Status */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Status</p>
            <div className="flex flex-wrap gap-3">
              {STATUS_OPTIONS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={statusFilters[key]}
                    onCheckedChange={(checked) => {
                      const next = { ...statusFilters, [key]: !!checked }
                      // Garante pelo menos um selecionado
                      if (!next.pending && !next.confirmed) return
                      setStatusFilters(next)
                      setPage(1)
                    }}
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Linha 2: Período + Busca lado a lado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-2">Período</p>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={periodFieldDraft} onValueChange={(v) => setPeriodFieldDraft(v as "created" | "confirmed")}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder="Campo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created">Criado</SelectItem>
                    <SelectItem value="confirmed">Confirmado</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={periodFromDraft}
                  onChange={(e) => setPeriodFromDraft(e.target.value)}
                  className="w-[140px]"
                />
                <span className="text-gray-500">até</span>
                <Input
                  type="date"
                  value={periodToDraft}
                  onChange={(e) => setPeriodToDraft(e.target.value)}
                  className="w-[140px]"
                />
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  onClick={() => {
                    if ((periodFromDraft || periodToDraft) && (!periodFromDraft || !periodToDraft)) {
                      toast.warning({
                        title: "Período incompleto",
                        description: "Preencha as duas datas para filtrar.",
                      })
                      return
                    }
                    setPeriodFromApplied(periodFromDraft)
                    setPeriodToApplied(periodToDraft)
                    setPeriodFieldApplied(periodFieldDraft)
                    setPage(1)
                  }}
                >
                  Filtrar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPeriodFromDraft("")
                    setPeriodToDraft("")
                    setPeriodFieldDraft("created")
                    setPeriodFromApplied("")
                    setPeriodToApplied("")
                    setPeriodFieldApplied("created")
                    setPage(1)
                  }}
                >
                  Limpar
                </Button>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">Buscar por nome ou número do pedido</p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    type="text"
                    placeholder="Digite e pressione Enter..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setSearchQuery(searchInput)
                        setPage(1)
                      }
                    }}
                    className="pl-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setSearchQuery(searchInput)
                      setPage(1)
                    }}
                  >
                    Buscar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchInput("")
                      setSearchQuery("")
                      setPage(1)
                    }}
                  >
                    Limpar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg font-bold">Links registrados</CardTitle>
              <CardDescription className="text-sm">
                {total > 0
                  ? `Exibindo ${(page - 1) * PAGE_SIZE + 1} a ${Math.min(page * PAGE_SIZE, total)} de ${total} link(s)`
                  : "Nenhum link com os filtros selecionados"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto overflow-y-auto md:max-h-[420px] max-h-[420px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Datas</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingList ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : links.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      Nenhum link encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  links.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <p className="font-medium">{link.customer_name.toUpperCase()}</p>
                          <button
                            onClick={() => copyToClipboard(link.customer_name, "Nome")}
                            className="text-gray-500 hover:text-gray-700"
                            title="Copiar nome"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => copyToClipboard(link.order_number, "Pedido")}
                          className="flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900"
                        >
                          <span>{link.order_number}</span>
                          <Copy className="w-3 h-3" />
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{link.quantity} {link.quantity === 1 ? "produto" : "produtos"}</Badge>
                      </TableCell>
                      <TableCell>
                        {link.status === "confirmed" ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Confirmado</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-xs text-gray-700">
                          <span className="font-medium text-gray-600">🆕 Criado em:</span>
                          <br />
                          {formatDate(link.created_at)}
                        </p>
                        {link.confirmed_at && (
                          <p className="text-xs text-gray-700 mt-2">
                            <span className="font-medium text-green-600">✅ Confirmado em:</span>
                            <br />
                            {formatDate(link.confirmed_at)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(link.generated_url, "Link")}
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Link
                          </Button>
                          {link.message && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(link.message ?? "", "Mensagem")}
                            >
                              <Copy className="w-3 h-3 mr-1" />
                              Mensagem
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {total > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between w-full">
              <p className="text-sm text-gray-500 whitespace-nowrap px-2">
                Página {page} de {totalPages}
              </p>
              <Pagination>
                <PaginationContent className="w-full justify-end gap-2">
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        if (page > 1) setPage((p) => p - 1)
                      }}
                      className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        if (page < totalPages) setPage((p) => p + 1)
                      }}
                      className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de sucesso */}
      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex justify-center mb-3">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <DialogTitle className="text-center">Link registrado com sucesso</DialogTitle>
            <DialogDescription className="text-center">
              Compartilhe o link com o cliente para que ele possa fazer o pedido.
            </DialogDescription>
          </DialogHeader>
          {createdLink && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>URL gerada</Label>
                <div className="flex gap-2">
                  <Input value={createdLink.generated_url} readOnly />
                  <Button variant="outline" onClick={() => copyToClipboard(createdLink.generated_url, "Link")}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              {createdLink.message && (
                <div className="space-y-1">
                  <Label>Mensagem</Label>
                  <pre className="rounded-md border bg-gray-50 p-3 text-sm whitespace-pre-wrap break-words font-sans text-gray-800 max-h-60 overflow-y-auto">
                    {createdLink.message}
                  </pre>
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={() => copyToClipboard(createdLink.message ?? "", "Mensagem")}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copiar mensagem
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setSuccessOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Mensagem padrão */}
      <Dialog open={messageModalOpen} onOpenChange={setMessageModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Mensagem padrão</DialogTitle>
            <DialogDescription>
              Esse texto será pré-preenchido ao criar um novo link. Use o marcador{" "}
              <code className="bg-gray-100 px-1 rounded">{PLACEHOLDER_TOKEN}</code> onde o link deve aparecer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={defaultTemplate}
              onChange={(e) => setDefaultTemplate(e.target.value)}
              disabled={defaultTemplateLoading}
              rows={6}
              placeholder={`Ex.: Olá! Aqui está o link do seu pedido: ${PLACEHOLDER_TOKEN}`}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageModalOpen(false)} disabled={savingTemplate}>
              Cancelar
            </Button>
            <Button onClick={handleSaveDefaultTemplate} disabled={defaultTemplateLoading || savingTemplate}>
              <Save className="w-4 h-4 mr-2" />
              {savingTemplate ? "Salvando..." : "Salvar template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Configurações de acesso */}
      <Dialog open={settingsModalOpen} onOpenChange={setSettingsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configurações de acesso</DialogTitle>
            <DialogDescription>
              Controle como o catálogo trata links não registrados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  Restringir acesso ao catálogo (modo pedido)
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Quando ativado, apenas links registrados nesta aba podem entrar em modo pedido.
                  URLs não registradas exibem a tela de "URL Inválida".
                </p>
              </div>
              <Switch
                checked={accessSettingsDraft.catalog_access_restricted}
                disabled={accessSettingsLoading || savingAccessSettings}
                onCheckedChange={(checked) => {
                  setAccessSettingsDraft((prev) => ({
                    catalog_access_restricted: checked,
                    // Coerência: se restrição liga, auto-registro perde o sentido.
                    auto_register_links_on_confirm: checked
                      ? false
                      : prev.auto_register_links_on_confirm,
                  }))
                }}
              />
            </div>

            {!accessSettingsDraft.catalog_access_restricted && (
              <div className="flex items-start justify-between gap-4 border-t pt-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    Registrar links automaticamente ao confirmar pedido
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Quando ativado, pedidos confirmados a partir de URLs sem link prévio
                    geram automaticamente um registro de link com status "Confirmado".
                  </p>
                </div>
                <Switch
                  checked={accessSettingsDraft.auto_register_links_on_confirm}
                  disabled={accessSettingsLoading || savingAccessSettings}
                  onCheckedChange={(checked) => {
                    setAccessSettingsDraft((prev) => ({
                      ...prev,
                      auto_register_links_on_confirm: checked,
                    }))
                  }}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSettingsModalOpen(false)}
              disabled={savingAccessSettings}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveAccessSettings}
              disabled={accessSettingsLoading || savingAccessSettings}
            >
              <Save className="w-4 h-4 mr-2" />
              {savingAccessSettings ? "Salvando..." : "Salvar configurações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
