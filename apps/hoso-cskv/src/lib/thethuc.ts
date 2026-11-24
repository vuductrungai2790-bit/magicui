/**
 * Chuẩn hóa thể thức văn bản theo Nghị định 30/2020/NĐ-CP về công tác văn thư (Phụ lục I):
 *  - Khổ giấy A4 (210 mm × 297 mm).
 *  - Lề trên, lề dưới: 20–25 mm; lề trái: 30–35 mm; lề phải: 15–20 mm.
 *  - Phông chữ tiếng Việt Times New Roman (bộ mã Unicode TCVN 6909:2001).
 * Chỉ điều chỉnh khi file nằm ngoài khoảng cho phép; cỡ chữ, căn lề, kiểu chữ giữ nguyên theo mẫu.
 */
import type PizZip from "pizzip"

const TWIPS_PER_MM = 1440 / 25.4
const mm = (v: number): number => Math.round(v * TWIPS_PER_MM)
const toMm = (twips: number): number => Math.round(twips / TWIPS_PER_MM)

const A4_SHORT = 11_906
const A4_LONG = 16_838

const MARGINS: Record<"top" | "bottom" | "left" | "right", [number, number, string]> = {
  top: [mm(20), mm(25), "Lề trên"],
  bottom: [mm(20), mm(25), "Lề dưới"],
  left: [mm(30), mm(35), "Lề trái"],
  right: [mm(15), mm(20), "Lề phải"],
}

const FONT = "Times New Roman"
const FONT_TAG = `<w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}" w:eastAsia="${FONT}"/>`
const RFONTS_RE = /<w:rFonts\b[^>]*?\/>/g
const RFONTS_OPEN_RE = /<w:rFonts\b[^>]*?>(?:<\/w:rFonts>)/g
const FONT_FILES_RE = /^word\/(document|styles|numbering|header\d*|footer\d*|footnotes|endnotes)\.xml$/
const PGSZ_RE = /<w:pgSz\b[^>]*\/>/g
const PGMAR_RE = /<w:pgMar\b[^>]*\/>/g
const ATTR_RE = (name: string): RegExp => new RegExp(`w:${name}="(-?\\d+)"`)

const getAttr = (tag: string, name: string): number | null => {
  const m = ATTR_RE(name).exec(tag)
  return m ? Number(m[1]) : null
}

const setAttr = (tag: string, name: string, value: number): string =>
  ATTR_RE(name).test(tag)
    ? tag.replace(ATTR_RE(name), `w:${name}="${value}"`)
    : tag.replace(/\/>$/, ` w:${name}="${value}"/>`)

const normalizePage = (xml: string, changes: Set<string>): string => {
  let out = xml.replace(PGSZ_RE, (tag) => {
    const w = getAttr(tag, "w") ?? A4_SHORT
    const h = getAttr(tag, "h") ?? A4_LONG
    const landscape = w > h
    const [tw, th] = landscape ? [A4_LONG, A4_SHORT] : [A4_SHORT, A4_LONG]
    if (Math.abs(w - tw) > 20 || Math.abs(h - th) > 20) {
      changes.add("Khổ giấy: chuyển về A4")
    }
    return setAttr(setAttr(tag, "w", tw), "h", th)
  })
  out = out.replace(PGMAR_RE, (tag) => {
    let next = tag
    for (const [side, [min, max, label]] of Object.entries(MARGINS)) {
      const v = getAttr(next, side)
      if (v === null) {
        continue
      }
      const clamped = Math.min(Math.max(Math.abs(v), min), max)
      if (Math.abs(clamped - Math.abs(v)) > 10) {
        changes.add(`${label}: ${toMm(Math.abs(v))} mm → ${toMm(clamped)} mm`)
        next = setAttr(next, side, clamped)
      }
    }
    return next
  })
  return out
}

/** Áp chuẩn thể thức lên file Word đã ghép dữ liệu. Trả về danh sách điều chỉnh. */
export const normalizeDocx = (zip: PizZip): string[] => {
  const changes = new Set<string>()
  for (const name of Object.keys(zip.files)) {
    if (!FONT_FILES_RE.test(name)) {
      continue
    }
    const file = zip.file(name)
    if (!file) {
      continue
    }
    let xml = file.asText()
    let fontChanged = false
    xml = xml.replace(RFONTS_RE, (tag) => {
      if (tag !== FONT_TAG) {
        fontChanged = fontChanged || !tag.includes(`w:ascii="${FONT}"`) || tag.includes("Theme")
      }
      return FONT_TAG
    })
    xml = xml.replace(RFONTS_OPEN_RE, FONT_TAG)
    if (fontChanged) {
      changes.add(`Phông chữ: chuyển sang ${FONT}`)
    }
    if (name === "word/document.xml") {
      xml = normalizePage(xml, changes)
    }
    zip.file(name, xml)
  }
  return [...changes]
}
