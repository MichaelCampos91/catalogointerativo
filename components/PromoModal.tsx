"use client"

import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { PromoModalView, type PromoModalContent } from "@/components/PromoModalView"

type ActivePromoModal = PromoModalContent & {
  id: string
  open_delay_seconds: number
  max_displays: number
}

/**
 * Modal promocional público. Busca o modal ativo, respeita o limite de
 * exibições por navegador (localStorage) e abre após o atraso configurado.
 * Registra o clique do botão via API (contagem total).
 */
export function PromoModal() {
  const [modal, setModal] = useState<ActivePromoModal | null>(null)
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch("/api/promo-modal/active")
        if (!res.ok) return
        const data = await res.json()
        const active: ActivePromoModal | null = data.modal ?? null
        if (cancelled || !active) return

        const storageKey = `promoModal:${active.id}:shown`
        let shown = 0
        try {
          shown = Number(localStorage.getItem(storageKey) || "0")
        } catch {
          shown = 0
        }
        if (shown >= active.max_displays) return

        setModal(active)
        const delayMs = Math.max(0, active.open_delay_seconds) * 1000
        timerRef.current = setTimeout(() => {
          if (cancelled) return
          setOpen(true)
          try {
            localStorage.setItem(storageKey, String(shown + 1))
          } catch {
            // localStorage indisponível: exibe mesmo assim
          }
        }, delayMs)
      } catch {
        // silencioso: modal promocional não deve quebrar a página
      }
    }

    load()

    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleButtonClick = () => {
    if (!modal) return
    // Registra o clique (best-effort) e abre o link.
    try {
      fetch("/api/promo-modal/click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: modal.id }),
        keepalive: true,
      }).catch(() => {})
    } catch {
      // ignora falhas de rede
    }
    if (modal.button_url) {
      window.open(modal.button_url, "_blank", "noopener,noreferrer")
    }
    setOpen(false)
  }

  if (!modal) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md overflow-hidden p-0" style={{ backgroundColor: modal.background_color }}>
        <DialogTitle className="sr-only">Promoção</DialogTitle>
        <PromoModalView modal={modal} onButtonClick={handleButtonClick} />
      </DialogContent>
    </Dialog>
  )
}
