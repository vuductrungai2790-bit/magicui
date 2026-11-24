import Docxtemplater from "docxtemplater"
import InspectModule from "docxtemplater/js/inspect-module.js"
import PizZip from "pizzip"

import { normalizeDocx } from "./thethuc"

import type { DossierComponent, DossierData, FieldDef, FieldValue, TemplateTags } from "./types"
import {
  capitalizeFirst,
  dateToWords,
  formatDate,
  formatNumber,
  moneyToWords,
  numberToWords,
  officialDay,
  officialMonth,
  parseIsoDate,
  parseNumber,
  parseTime,
  timeToWords,
  todayIso,
} from "./vn"

/** Chỗ trống in ra khi chưa nhập thông tin, để có thể viết tay bổ sung. */
export const BLANK = "……………………"

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

interface PartLike {
  type: string
  value: string
  inverted?: boolean
  module?: string
  subparsed?: PartLike[]
}

const collect = (parts: PartLike[], tags: TemplateTags, inside: string[] | null): void => {
  for (const part of parts) {
    if (part.type !== "placeholder") {
      continue
    }
    const name = part.value.trim()
    if (!name || name.includes(" ") || name.includes(".")) {
      continue
    }
    if (part.module === "loop") {
      const children: string[] = []
      tags.sections.push({ name, children, inverted: part.inverted === true })
      inside?.push(name)
      collect(part.subparsed ?? [], tags, children)
    } else if (!part.module) {
      const target = inside ?? tags.simple
      if (!target.includes(name)) {
        target.push(name)
      }
    }
  }
}

const mergeSections = (tags: TemplateTags): TemplateTags => {
  const map = new Map<string, { children: string[]; inverted: boolean }>()
  for (const s of tags.sections) {
    const prev = map.get(s.name)
    map.set(s.name, {
      children: [...new Set([...(prev?.children ?? []), ...s.children])],
      inverted: (prev?.inverted ?? true) && s.inverted === true,
    })
  }
  return {
    simple: tags.simple,
    sections: [...map.entries()].map(([name, v]) => ({ name, children: v.children, inverted: v.inverted })),
  }
}

export class TemplateError extends Error {
  readonly details: string[]

  constructor(message: string, details: string[] = []) {
    super(message)
    this.name = "TemplateError"
    this.details = details
  }
}

interface DxtErrorLike {
  properties?: {
    errors?: { properties?: { explanation?: string } }[]
    explanation?: string
  }
}

const explainError = (error: unknown): TemplateError => {
  const e = error as DxtErrorLike
  const list = e.properties?.errors?.map((x) => x.properties?.explanation ?? "").filter(Boolean) ?? []
  if (list.length === 0 && e.properties?.explanation) {
    list.push(e.properties.explanation)
  }
  return new TemplateError(
    "Biểu mẫu có thẻ đánh dấu chưa đúng (thiếu dấu ngoặc, khối mở/đóng không khớp…).",
    list
  )
}

const openZip = (buffer: ArrayBuffer): PizZip => {
  try {
    return new PizZip(buffer)
  } catch {
    throw new TemplateError("Không đọc được file. Hãy chắc chắn đây là file Word .docx (không phải .doc).")
  }
}

/** Đọc các thẻ {…} trong file Word. */
export const inspectTemplate = (buffer: ArrayBuffer): TemplateTags => {
  const inspect = new InspectModule()
  try {
    new Docxtemplater(openZip(buffer), {
      modules: [inspect],
      paragraphLoop: true,
      linebreaks: true,
    })
  } catch (error) {
    throw explainError(error)
  }
  const tags: TemplateTags = { simple: [], sections: [] }
  collect(inspect.getAllStructuredTags() as unknown as PartLike[], tags, null)
  return mergeSections(tags)
}

type RenderValue = string | boolean | Record<string, string>[]

const deriveScalar = (
  out: Record<string, RenderValue>,
  code: string,
  type: FieldDef["type"],
  raw: string
): void => {
  if (!raw) {
    return
  }
  switch (type) {
    case "date": {
      const p = parseIsoDate(raw)
      if (!p) {
        out[code] = raw
        return
      }
      out[code] = formatDate(raw)
      out[`${code}_chu`] = dateToWords(raw)
      out[`${code}_ngay`] = officialDay(p.day)
      out[`${code}_thang`] = officialMonth(p.month)
      out[`${code}_nam`] = String(p.year)
      return
    }
    case "time": {
      const t = parseTime(raw)
      out[code] = raw
      if (t) {
        out[`${code}_chu`] = timeToWords(raw)
        out[`${code}_gio`] = t.hour
        out[`${code}_phut`] = t.minute
      }
      return
    }
    case "money":
    case "number": {
      const n = parseNumber(raw)
      if (n === null) {
        out[code] = raw
        return
      }
      out[code] = formatNumber(n)
      out[`${code}_chu`] = type === "money" ? moneyToWords(n) : capitalizeFirst(numberToWords(n))
      return
    }
    default: {
      // NĐ 30/2020: số văn bản nhỏ hơn 10 ghi thêm số 0 phía trước.
      const value = code === "so_van_ban" && /^\d$/.test(raw) ? `0${raw}` : raw
      out[code] = value
      out[`${code}_hoa`] = value.toLocaleUpperCase("vi")
    }
  }
}

/**
 * Chuyển dữ liệu nhập thành dữ liệu để ghép vào mẫu, kèm các biến thể
 * (_chu, _ngay, _thang, _nam, _gio, _phut, _hoa).
 */
export const buildRenderData = (
  fields: Map<string, FieldDef>,
  data: DossierData
): Record<string, RenderValue> => {
  const out: Record<string, RenderValue> = {}

  deriveScalar(out, "hom_nay", "date", todayIso())

  for (const [code, value] of Object.entries(data)) {
    const def = fields.get(code)
    const type = def?.type ?? "text"

    if (type === "table") {
      const rows = Array.isArray(value) ? value : []
      out[code] = rows.map((row, i) => {
        const r: Record<string, RenderValue> = { stt: String(i + 1) }
        for (const col of def?.columns ?? []) {
          deriveScalar(r, col.code, col.type, String(row[col.code] ?? "").trim())
        }
        return r as Record<string, string>
      })
      continue
    }

    if (type === "boolean") {
      const b = value === true
      out[code] = b
      out[`${code}_chu`] = b ? "Có" : "Không"
      continue
    }

    deriveScalar(out, code, type, typeof value === "string" ? value.trim() : "")
  }

  return out
}

export interface RenderOptions {
  /** Thẻ đã có sẵn dấu chấm của mẫu: để trống thì không in thêm "……". */
  guarded?: string[]
  /** Chuẩn hóa thể thức theo NĐ 30/2020 (khổ giấy, lề, phông chữ). */
  normalize?: boolean
}

export interface RenderResult {
  blob: Blob
  /** Các điều chỉnh thể thức đã áp dụng. */
  changes: string[]
}

export const renderTemplate = async (
  file: Blob,
  renderData: Record<string, RenderValue>,
  options: RenderOptions = {}
): Promise<RenderResult> => {
  const buffer = await file.arrayBuffer()
  const guarded = new Set(options.guarded ?? [])
  let doc: Docxtemplater
  try {
    doc = new Docxtemplater(openZip(buffer), {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: (part) => {
        if (part.module === "loop" || part.module === "rawxml" || guarded.has(part.value)) {
          return ""
        }
        return BLANK
      },
    })
    doc.render(renderData)
  } catch (error) {
    throw error instanceof TemplateError ? error : explainError(error)
  }
  const zip = doc.getZip()
  const changes = options.normalize ? normalizeDocx(zip) : []
  const blob = zip.generate({ type: "blob", mimeType: DOCX_MIME, compression: "DEFLATE" }) as Blob
  return { blob, changes }
}

export const isComponentIncluded = (component: DossierComponent, data: DossierData): boolean =>
  !component.conditionField || data[component.conditionField] === true

export const isFilled = (def: FieldDef, value: FieldValue | undefined): boolean => {
  if (def.type === "table") {
    return Array.isArray(value) && value.length > 0
  }
  if (def.type === "boolean") {
    return typeof value === "boolean"
  }
  return typeof value === "string" && value.trim().length > 0
}

const CCCD_RE = /^\d{12}$/
const PHONE_RE = /^0\d{9}$/

/** Trả về thông báo lỗi nếu giá trị không hợp lệ. */
export const validateValue = (def: FieldDef, value: FieldValue | undefined): string | null => {
  if (def.required && !isFilled(def, value)) {
    return "Bắt buộc nhập"
  }
  if (typeof value !== "string" || !value.trim()) {
    return null
  }
  const v = value.trim()
  if (def.type === "cccd" && !CCCD_RE.test(v)) {
    return "Số định danh gồm đúng 12 chữ số"
  }
  if (def.type === "phone" && !PHONE_RE.test(v.replace(/\s/g, ""))) {
    return "Số điện thoại gồm 10 chữ số, bắt đầu bằng 0"
  }
  if ((def.type === "money" || def.type === "number") && parseNumber(v) === null) {
    return "Chỉ nhập số"
  }
  return null
}

export const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
