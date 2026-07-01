"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Plus, Pencil, Trash2, MousePointerClick, Megaphone } from "lucide-react"
import { useToast } from "@/hooks/use-sonner-toast"
import { PromoModalForm, DEFAULT_PROMO_MODAL, type PromoModalFormValues } from "@/components/admin/PromoModalForm"

type PromoModal = PromoModalFormValues & {
  id: string
  active: boolean
  click_count: number
  created_at: string
}

export default function PromoModalAdminPage() {
  const toast = useToast()
  const [modals, setModals] = useState<PromoModal[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PromoModal | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PromoModal | null>(null)

  const loadModals = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/promo-modal")
      if (!res.ok) throw new Error("Falha ao carregar modais")
      const data = await res.json()
      setModals(data.modals || [])
    } catch (error) {
      toast.error({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao carregar modais",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadModals()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (modal: PromoModal) => {
    setEditing(modal)
    setFormOpen(true)
  }

  const handleToggleActive = async (modal: PromoModal, active: boolean) => {
    try {
      const res = await fetch(`/api/promo-modal/${modal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Erro ao alterar status")
      }
      await loadModals()
      toast.success({
        title: active ? "Modal ativado" : "Modal inativado",
        description: active ? "Este é agora o único modal ativo." : "O modal foi inativado.",
      })
    } catch (error) {
      toast.error({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/promo-modal/${deleteTarget.id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Erro ao excluir")
      }
      setDeleteTarget(null)
      await loadModals()
      toast.success({ title: "Excluído", description: "Modal removido com sucesso." })
    } catch (error) {
      toast.error({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      })
    }
  }

  const toFormValues = (modal: PromoModal): PromoModalFormValues => ({
    name: modal.name,
    title_html: modal.title_html,
    description_html: modal.description_html,
    title_align: modal.title_align,
    title_color: modal.title_color,
    title_size: modal.title_size,
    title_bold: modal.title_bold,
    desc_align: modal.desc_align,
    desc_color: modal.desc_color,
    desc_size: modal.desc_size,
    desc_bold: modal.desc_bold,
    background_color: modal.background_color,
    button_text: modal.button_text,
    button_url: modal.button_url,
    button_bg_color: modal.button_bg_color,
    button_text_color: modal.button_text_color,
    open_delay_seconds: modal.open_delay_seconds,
    max_displays: modal.max_displays,
  })

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Modal Promocional</h1>
          <p className="text-gray-600">
            Gerencie o modal exibido nas páginas de pedido confirmado e lista de pedidos.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Cadastrar novo
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-bold">Modais cadastrados</CardTitle>
          <CardDescription>Apenas um modal pode ficar ativo por vez.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-gray-500">Carregando...</div>
          ) : modals.length === 0 ? (
            <div className="py-10 text-center text-gray-500">
              <Megaphone className="w-10 h-10 mx-auto mb-3 text-gray-400" />
              Nenhum modal cadastrado ainda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cliques</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modals.map((modal) => (
                    <TableRow key={modal.id}>
                      <TableCell className="font-medium">{modal.name || "(sem nome)"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={modal.active}
                            onCheckedChange={(c) => handleToggleActive(modal, c)}
                          />
                          {modal.active ? (
                            <Badge className="bg-green-600 hover:bg-green-600">Ativo</Badge>
                          ) : (
                            <Badge variant="secondary">Inativo</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-sm">
                          <MousePointerClick className="h-4 w-4 text-indigo-600" />
                          {modal.click_count}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(modal)}>
                            <Pencil className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(modal)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de formulário */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar modal promocional" : "Novo modal promocional"}</DialogTitle>
          </DialogHeader>
          <PromoModalForm
            initialValues={editing ? toFormValues(editing) : DEFAULT_PROMO_MODAL}
            editingId={editing?.id ?? null}
            onSaved={() => {
              setFormOpen(false)
              loadModals()
            }}
            onCancel={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modal?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o modal "{deleteTarget?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
