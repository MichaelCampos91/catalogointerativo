import DOMPurify from "isomorphic-dompurify"
import type { PromoModalInput } from "@/lib/database"

/**
 * Sanitiza HTML gerado pelo editor rich (Tiptap) antes de persistir.
 * Allowlist propositalmente restrita: formatação básica, links, imagens e
 * `span[style]` (usado para cor/tamanho por trecho). Remove scripts, handlers
 * inline (onclick, etc.) e demais vetores de XSS.
 */
export function sanitizePromoHtml(html: string): string {
  return DOMPurify.sanitize(html ?? "", {
    ALLOWED_TAGS: [
      "p", "br", "b", "strong", "i", "em", "u", "s", "span", "a", "img",
      "ul", "ol", "li", "h1", "h2", "h3", "h4", "blockquote", "div",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "style", "class"],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|\/|#)/i,
    ADD_ATTR: ["target"],
  })
}

const MAX_HTML_LENGTH = 20000
const MAX_TEXT_LENGTH = 200
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const ALIGNS = ["left", "center", "right", "justify"]

function normalizeColor(value: unknown, fallback: string): string {
  if (typeof value === "string" && HEX_COLOR.test(value.trim())) {
    return value.trim()
  }
  return fallback
}

function normalizeAlign(value: unknown, fallback: string): string {
  if (typeof value === "string" && ALIGNS.includes(value)) {
    return value
  }
  return fallback
}

function normalizeSize(value: unknown, fallback: string): string {
  const n = Number(value)
  if (Number.isFinite(n) && n >= 8 && n <= 96) {
    return String(Math.round(n))
  }
  return fallback
}

function normalizeInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value)
  if (Number.isFinite(n)) {
    return Math.min(max, Math.max(min, Math.round(n)))
  }
  return fallback
}

function normalizeText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback
  return value.trim().slice(0, MAX_TEXT_LENGTH)
}

function normalizeUrl(value: unknown): string {
  if (typeof value !== "string") return ""
  const trimmed = value.trim().slice(0, 2000)
  if (!trimmed) return ""
  if (/^(?:https?:\/\/|\/|#|mailto:|tel:)/i.test(trimmed)) {
    return trimmed
  }
  return ""
}

/**
 * Valida e normaliza o payload de criação/edição do modal promocional.
 * Retorna `{ valid, value }` ou `{ valid: false, message }`.
 */
export function parsePromoModalPayload(
  body: unknown
): { valid: true; value: PromoModalInput } | { valid: false; message: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, message: "Payload inválido" }
  }
  const b = body as Record<string, unknown>

  const title_html = sanitizePromoHtml(typeof b.title_html === "string" ? b.title_html : "")
  const description_html = sanitizePromoHtml(typeof b.description_html === "string" ? b.description_html : "")

  if (title_html.length > MAX_HTML_LENGTH || description_html.length > MAX_HTML_LENGTH) {
    return { valid: false, message: "Conteúdo do modal muito longo" }
  }

  const value: PromoModalInput = {
    name: normalizeText(b.name) || "Modal sem nome",
    title_html,
    description_html,
    title_align: normalizeAlign(b.title_align, "center"),
    title_color: normalizeColor(b.title_color, "#111827"),
    title_size: normalizeSize(b.title_size, "24"),
    title_bold: b.title_bold === true,
    desc_align: normalizeAlign(b.desc_align, "center"),
    desc_color: normalizeColor(b.desc_color, "#374151"),
    desc_size: normalizeSize(b.desc_size, "16"),
    desc_bold: b.desc_bold === true,
    background_color: normalizeColor(b.background_color, "#ffffff"),
    button_text: normalizeText(b.button_text),
    button_url: normalizeUrl(b.button_url),
    button_bg_color: normalizeColor(b.button_bg_color, "#4f46e5"),
    button_text_color: normalizeColor(b.button_text_color, "#ffffff"),
    open_delay_seconds: normalizeInt(b.open_delay_seconds, 3, 0, 120),
    max_displays: normalizeInt(b.max_displays, 1, 1, 100),
  }

  return { valid: true, value }
}
