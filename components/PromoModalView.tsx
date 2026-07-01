"use client"

import type { CSSProperties } from "react"

export type PromoModalContent = {
  title_html: string
  description_html: string
  title_align: string
  title_color: string
  title_size: string
  title_bold: boolean
  desc_align: string
  desc_color: string
  desc_size: string
  desc_bold: boolean
  background_color: string
  button_text: string
  button_url: string
  button_bg_color: string
  button_text_color: string
}

type PromoModalViewProps = {
  modal: PromoModalContent
  onButtonClick?: () => void
}

function textBlockStyle(align: string, color: string, size: string, bold: boolean): CSSProperties {
  return {
    textAlign: (align as CSSProperties["textAlign"]) || "center",
    color: color || "#111827",
    fontSize: `${size || "16"}px`,
    fontWeight: bold ? 700 : 400,
    lineHeight: 1.4,
    wordBreak: "break-word",
  }
}

/**
 * Renderização compartilhada do conteúdo do modal promocional. Usada tanto no
 * preview do admin quanto no modal público. O HTML já vem sanitizado do backend.
 */
export function PromoModalView({ modal, onButtonClick }: PromoModalViewProps) {
  return (
    <div
      className="rounded-lg p-6 space-y-4"
      style={{ backgroundColor: modal.background_color || "#ffffff" }}
    >
      {modal.title_html && (
        <div
          className="promo-modal-content"
          style={textBlockStyle(modal.title_align, modal.title_color, modal.title_size, modal.title_bold)}
          dangerouslySetInnerHTML={{ __html: modal.title_html }}
        />
      )}

      {modal.description_html && (
        <div
          className="promo-modal-content"
          style={textBlockStyle(modal.desc_align, modal.desc_color, modal.desc_size, modal.desc_bold)}
          dangerouslySetInnerHTML={{ __html: modal.description_html }}
        />
      )}

      {modal.button_text && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={onButtonClick}
            className="inline-flex items-center justify-center rounded-md px-6 py-2.5 text-sm font-semibold shadow transition-opacity hover:opacity-90"
            style={{ backgroundColor: modal.button_bg_color, color: modal.button_text_color }}
          >
            {modal.button_text}
          </button>
        </div>
      )}
    </div>
  )
}
