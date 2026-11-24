/**
 * Tự nhận diện chỗ cần điền trong biểu mẫu Word và chuyển thành thẻ {ma_truong}.
 *
 * Nhận diện 3 dạng:
 *  1. Dấu chấm / gạch: "Họ và tên: ……………"
 *  2. Nhãn kèm phím Tab có đường dẫn chấm: "Nghề nghiệp:⇥⇥"
 *  3. Mẫu đã điền sẵn: "Họ và tên: LÂM THẾ CHÂU" → giá trị cũ thành ví dụ
 * và các cụm đặc biệt: "ngày … tháng … năm …", "hồi … giờ …", dòng địa danh – ngày tháng,
 * tên cơ quan ở góc trái, người ký, nhiều dòng chấm để viết đoạn văn.
 */
import { DOMParser, XMLSerializer } from "@xmldom/xmldom"
import PizZip from "pizzip"

import { inferType } from "./fields"
import {
  AMBIGUOUS_LABELS,
  applySubject,
  detectSubject,
  groupForCode,
  isSkippedLabel,
  lookupLabel,
  MAX_LABEL_WORDS,
  normalizeLabel,
  type Subject,
  typeForCode,
} from "./labels"
import type { FieldType } from "./types"
import { removeDiacritics, toFieldCode } from "./vn"

/* ------------------------------------------------------------------ */
/* Kiểu dữ liệu                                                         */
/* ------------------------------------------------------------------ */

export type BlankMode =
  /** Giữ nguyên dấu chấm / tab của mẫu khi để trống, thay bằng nội dung khi có. */
  | "guard"
  /** Thay giá trị mẫu bằng nội dung nhập. */
  | "replace"
  /** Chèn nội dung vào vị trí (không có gì để thay). */
  | "insert"

export type BlankSuffix = "" | "_ngay" | "_thang" | "_nam" | "_gio" | "_phut" | "_hoa"

export interface Blank {
  id: string
  para: number
  start: number
  end: number
  mode: BlankMode
  /** Mã trường gốc. */
  code: string
  suffix: BlankSuffix
  label: string
  type: FieldType
  group: string
  sample?: string
  confidence: "high" | "low"
  /** Các đoạn văn tiếp theo (dòng chấm) gộp vào trường này. */
  lines?: number[]
  /** Thêm dấu cách trước nội dung (chỗ chấm dính liền chữ: "ngày……"). */
  pad?: boolean
}

export interface ParagraphInfo {
  index: number
  text: string
}

export interface BlankAnalysis {
  paragraphs: ParagraphInfo[]
  blanks: Blank[]
  /** Mẫu đã có sẵn thẻ {…}: không cần nhận diện. */
  hasTags: boolean
}

/* ------------------------------------------------------------------ */
/* Đọc đoạn văn                                                         */
/* ------------------------------------------------------------------ */

type XmlDocument = ReturnType<DOMParser["parseFromString"]>
type XmlElement = NonNullable<XmlDocument["documentElement"]>
type XmlNode = XmlElement["firstChild"]

type Atom = { kind: "text"; node: XmlElement; text: string } | { kind: "tab"; node: XmlElement; text: "\t" }

interface Para {
  el: XmlElement
  atoms: Atom[]
  starts: number[]
  text: string
  cell: XmlElement | null
}

const SKIP_ELEMENTS = new Set([
  "w:p",
  "w:pPr",
  "w:rPr",
  "w:txbxContent",
  "mc:AlternateContent",
  "w:drawing",
  "w:pict",
  "w:del",
  "w:delText",
  "w:instrText",
  "w:object",
])

const isElement = (n: XmlNode): n is XmlElement => Boolean(n) && (n as XmlElement).nodeType === 1

const nodeText = (el: XmlElement): string => {
  let s = ""
  for (let c = el.firstChild; c; c = c.nextSibling) {
    if (c.nodeType === 3) {
      s += (c as unknown as { data: string }).data
    }
  }
  return s
}

const collectAtoms = (el: XmlElement, out: Atom[]): void => {
  for (let c = el.firstChild; c; c = c.nextSibling) {
    if (!isElement(c)) {
      continue
    }
    if (c.nodeName === "w:t") {
      out.push({ kind: "text", node: c, text: nodeText(c) })
    } else if (c.nodeName === "w:tab") {
      out.push({ kind: "tab", node: c, text: "\t" })
    } else if (!SKIP_ELEMENTS.has(c.nodeName)) {
      collectAtoms(c, out)
    }
  }
}

const findAncestor = (el: XmlElement, name: string): XmlElement | null => {
  let p = el.parentNode as XmlNode
  while (p && isElement(p)) {
    if (p.nodeName === name) {
      return p
    }
    p = p.parentNode as XmlNode
  }
  return null
}

const buildPara = (el: XmlElement): Para => {
  const atoms: Atom[] = []
  collectAtoms(el, atoms)
  const starts: number[] = []
  let text = ""
  for (const a of atoms) {
    starts.push(text.length)
    text += a.text
  }
  return { el, atoms, starts, text, cell: findAncestor(el, "w:tc") }
}

const readParagraphs = (doc: XmlDocument): Para[] => {
  const list = doc.getElementsByTagName("w:p")
  const out: Para[] = []
  for (let i = 0; i < list.length; i += 1) {
    const el = list.item(i)
    if (el) {
      out.push(buildPara(el))
    }
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Nhận diện                                                            */
/* ------------------------------------------------------------------ */

const DOTS_RE = /[.…_]{2,}(?:\s?[.…_]+)*/g
const B = "((?:[.…_]{2,}\\s?)+|\\d{1,4})"
const DATE_RE = new RegExp(`ngày\\s*${B}\\s*tháng\\s*${B}\\s*năm\\s*${B}`, "gid")
const TIME_RE = /(hồi|lúc)\s*((?:[.…_]{2,}\s?)+|\d{1,2})\s*giờ\s*((?:[.…_]{2,}\s?)+|\d{1,2})?/dgi
const DMY_RE = /(?<![\d/])(\d{1,2})\/(\d{1,2})\/(\d{4})(?![\d/])/g
const PLACE_LINE_RE = /^\s*([^,\t]{2,40}?),\s*ngày/d
const TITLE_RE =
  /^(QUYẾT ĐỊNH|THÔNG BÁO|BIÊN BẢN|BÁO CÁO|CAM ĐOAN|GIẤY|ĐƠN|TỜ KHAI|PHIẾU|LỆNH|KẾ HOẠCH|CÔNG VĂN|BẢN)/
const UNIT_LINE_RE = /^(CÔNG AN|UBND|ỦY BAN|UỶ BAN|BỘ |SỞ |CỤC |PHÒNG |ĐỘI |BAN )/
const SIGN_HINT_RE = /^\s*\(\s*k[ýy]/i
const WORD_RE = /\S+/g
const CASE_SPLIT_RE = /(?<=[\p{Ll}\d])(?=\p{Lu})/u
const ONLY_DOTS_RE = /^[\s.…_]+$/
const DIGITS_RE = /^\d+$/
const HAS_LOWER_RE = /\p{Ll}/u
const HAS_LETTER_RE = /\p{L}/u
const TRAILING_PUNCT_RE = /[\s.,;:]+$/
const LEADING_SPACE_RE = /^\s+/
const DASH_SPLIT_RE = /\s[-–]\s|;|\t|\s{3,}/

const isDots = (s: string): boolean => ONLY_DOTS_RE.test(s) && /[.…_]{2,}/.test(s)
const isUpper = (s: string): boolean => HAS_LETTER_RE.test(s) && !HAS_LOWER_RE.test(s)

interface Word {
  start: number
  end: number
  text: string
}

const splitWords = (text: string, offset: number): Word[] => {
  const words: Word[] = []
  for (const m of text.matchAll(WORD_RE)) {
    let pos = (m.index ?? 0) + offset
    for (const part of m[0].split(CASE_SPLIT_RE)) {
      words.push({ start: pos, end: pos + part.length, text: part })
      pos += part.length
    }
  }
  return words
}

const toIsoDate = (d: string, m: string, y: string): string | undefined => {
  const dd = Number(d)
  const mm = Number(m)
  const yy = Number(y)
  if (!(dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yy > 1900)) {
    return
  }
  return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`
}

class Detector {
  readonly blanks: Blank[] = []
  private readonly consumed = new Map<number, [number, number][]>()
  private nextId = 1

  constructor(private readonly paras: Para[]) {}

  isFree(para: number, start: number, end: number): boolean {
    return !(this.consumed.get(para) ?? []).some(([s, e]) => start < e && end > s)
  }

  consume(para: number, start: number, end: number): void {
    const list = this.consumed.get(para) ?? []
    list.push([start, end])
    this.consumed.set(para, list)
  }

  add(b: Omit<Blank, "id">): Blank | null {
    if (b.end < b.start || !this.isFree(b.para, b.start, Math.max(b.end, b.start + 1))) {
      return null
    }
    const before = this.paras[b.para]?.text[b.start - 1] ?? " "
    const pad = b.mode === "guard" && !b.lines && !/[\s(“"'/]/.test(before)
    const blank: Blank = { ...b, id: `b${this.nextId}`, ...(pad ? { pad } : {}) }
    this.nextId += 1
    this.blanks.push(blank)
    this.consume(b.para, b.start, Math.max(b.end, b.start + 1))
    return blank
  }

  /** Giá trị (chấm hoặc chữ) tại [s,e) → thêm chỗ điền. */
  addValue(
    para: number,
    s: number,
    e: number,
    base: Omit<Blank, "id" | "para" | "start" | "end" | "mode" | "sample">
  ): Blank | null {
    const text = this.paras[para]?.text ?? ""
    let start = s
    let end = e
    while (start < end && /\s/.test(text[start] ?? "")) {
      start += 1
    }
    while (end > start && /\s/.test(text[end - 1] ?? "")) {
      end -= 1
    }
    const raw = text.slice(start, end)
    if (!raw) {
      return null
    }
    if (isDots(raw)) {
      return this.add({ ...base, para, start, end, mode: "guard" })
    }
    return this.add({ ...base, para, start, end, mode: "replace", sample: raw })
  }
}

/** Dòng tiêu đề văn bản (QUYẾT ĐỊNH, BIÊN BẢN…) → các dòng phía trên là phần đầu. */
const findTitleIndex = (paras: Para[]): number => {
  const i = paras.findIndex((p) => TITLE_RE.test(p.text.trim()))
  return i === -1 ? Math.min(paras.length, 8) : i
}

const detectHeaderUnits = (d: Detector, paras: Para[], titleIndex: number): void => {
  const lines: number[] = []
  for (let i = 0; i < titleIndex; i += 1) {
    const t = paras[i]?.text.trim() ?? ""
    if (UNIT_LINE_RE.test(t) && isUpper(t) && !lines.some((j) => paras[j]?.text.trim() === t)) {
      lines.push(i)
    }
  }
  const codes = lines.length >= 2 ? ["ten_co_quan_cap_tren", "ten_don_vi"] : ["ten_don_vi"]
  lines.slice(0, 2).forEach((pi, k) => {
    const code = codes[k] ?? "ten_don_vi"
    const para = paras[pi]
    if (!para) {
      return
    }
    d.addValue(pi, 0, para.text.length, {
      code,
      suffix: "_hoa",
      label: code === "ten_don_vi" ? "Tên đơn vị" : "Cơ quan cấp trên",
      type: "text",
      group: "Đơn vị & cán bộ",
      confidence: "high",
    })
  })
}

const detectSignatures = (d: Detector, paras: Para[]): void => {
  paras.forEach((p, i) => {
    if (!(SIGN_HINT_RE.test(p.text) && p.cell)) {
      return
    }
    const cellParas = paras.map((q, j) => ({ q, j })).filter(({ q }) => q.cell === p.cell)
    const role =
      cellParas.find(({ q, j }) => j < i && isUpper(q.text.trim()))?.q.text.trim() ??
      cellParas.find(({ q }) => q.text.trim())?.q.text.trim() ??
      ""
    const after = cellParas.find(({ q, j }) => j > i && q.text.trim() && !q.text.trim().startsWith("("))
    if (!after) {
      return
    }
    const sample = after.q.text.trim()
    if (isUpper(sample) || isDots(sample)) {
      return
    }
    const r = removeDiacritics(role).toUpperCase()
    let code = `nguoi_ky_${toFieldCode(role).slice(0, 30)}`
    let label = `Người ký – ${role}`
    if (r.includes("CAN BO")) {
      code = "can_bo_ho_ten"
      label = "Cán bộ lập – họ tên"
    } else if (r.includes("TRUONG") || r.startsWith("KT") || r.startsWith("TM")) {
      code = "chi_huy_ky_ten"
      label = "Người có thẩm quyền ký (cấp bậc, họ tên)"
    } else if (r.includes("NGUOI BI") || r.includes("NGUOI VI PHAM")) {
      code = "ho_ten"
      label = "Họ và tên"
    }
    d.addValue(after.j, 0, after.q.text.length, {
      code,
      suffix: "",
      label,
      type: "text",
      group: code === "ho_ten" ? "Người vi phạm / đối tượng" : "Đơn vị & cán bộ",
      confidence: "high",
    })
  })
}

const dateCodeFor = (
  before: string,
  isPlaceLine: boolean
): { code: string; label: string; high: boolean } => {
  const b = removeDiacritics(before).toLowerCase()
  if (/sinh\s*$/.test(b)) {
    return { code: "ngay_sinh", label: "Ngày sinh", high: true }
  }
  if (/cap\s*$/.test(b)) {
    return { code: "ngay_cap", label: "Ngày cấp", high: true }
  }
  if (isPlaceLine || /hom nay/.test(b)) {
    return { code: "ngay_lap", label: "Ngày lập", high: true }
  }
  const words = before.trim().split(/\s+/).slice(-3).join(" ")
  const code = `ngay_${toFieldCode(words) || "khac"}`.slice(0, 40)
  return { code, label: `Ngày ${words}`.trim(), high: false }
}

const detectDates = (d: Detector, paras: Para[]): void => {
  paras.forEach((p, i) => {
    const place = PLACE_LINE_RE.exec(p.text)
    const isPlaceLine = Boolean(place) && p.text.trim().length < 90
    for (const m of p.text.matchAll(DATE_RE)) {
      const idx = m.indices
      if (!idx) {
        continue
      }
      const before = p.text.slice(0, m.index ?? 0)
      const { code, label, high } = dateCodeFor(before, isPlaceLine)
      const parts: [BlankSuffix, number][] = [
        ["_ngay", 1],
        ["_thang", 2],
        ["_nam", 3],
      ]
      for (const [suffix, g] of parts) {
        const range = idx[g]
        if (range) {
          d.addValue(i, range[0], range[1], {
            code,
            suffix,
            label,
            type: "date",
            group:
              code === "ngay_sinh" || code === "ngay_cap" ? "Người vi phạm / đối tượng" : "Thông tin chung",
            confidence: high ? "high" : "low",
          })
        }
      }
      d.consume(i, m.index ?? 0, (m.index ?? 0) + m[0].length)
    }
    if (isPlaceLine && place?.indices?.[1]) {
      const [s, e] = place.indices[1]
      d.addValue(i, s, e, {
        code: "dia_danh",
        suffix: "",
        label: "Địa danh",
        type: "text",
        group: "Đơn vị & cán bộ",
        confidence: "high",
      })
    }
  })
}

const detectTimes = (d: Detector, paras: Para[]): void => {
  paras.forEach((p, i) => {
    for (const m of p.text.matchAll(TIME_RE)) {
      const idx = m.indices
      if (!idx) {
        continue
      }
      const ctx = removeDiacritics(p.text.slice(0, m.index ?? 0)).toLowerCase()
      const ending = /xong|ket thuc/.test(ctx)
      const code = ending ? "gio_ket_thuc" : "gio_lap"
      const label = ending ? "Giờ kết thúc" : "Giờ lập"
      for (const [suffix, g] of [
        ["_gio", 2],
        ["_phut", 3],
      ] as [BlankSuffix, number][]) {
        const range = idx[g]
        if (range) {
          d.addValue(i, range[0], range[1], {
            code,
            suffix,
            label,
            type: "time",
            group: "Thông tin chung",
            confidence: "high",
          })
        }
      }
      d.consume(i, m.index ?? 0, (m.index ?? 0) + m[0].length)
    }
  })
}

/** "Hôm nay, vào hồi … ngày 20/10/2026 tại Trụ sở …" */
const detectOpeningLine = (d: Detector, paras: Para[]): void => {
  paras.forEach((p, i) => {
    const t = removeDiacritics(p.text.trim()).toLowerCase()
    if (!(t.startsWith("hom nay") || t.startsWith("vao hoi") || t.startsWith("hoi "))) {
      return
    }
    for (const m of p.text.matchAll(DMY_RE)) {
      const s = m.index ?? 0
      d.addValue(i, s, s + m[0].length, {
        code: "ngay_lap",
        suffix: "",
        label: "Ngày lập",
        type: "date",
        group: "Thông tin chung",
        confidence: "high",
      })
    }
    const at = p.text.search(/\stại\s/)
    if (at !== -1) {
      const s = at + 5
      let e = p.text.length
      while (e > s && /[\s.,;\t]/.test(p.text[e - 1] ?? "")) {
        e -= 1
      }
      d.addValue(i, s, e, {
        code: "dia_diem_lap",
        suffix: "",
        label: "Địa điểm lập",
        type: "text",
        group: "Thông tin chung",
        confidence: "high",
      })
    }
  })
}

interface LabelHit {
  colon: number
  labelStart: number
  label: string
  known: string | undefined
}

const findLabelStart = (
  text: string,
  segStart: number,
  colon: number,
  afterValue: boolean
): LabelHit | null => {
  const words = splitWords(text.slice(segStart, colon), segStart)
  if (words.length === 0) {
    return null
  }
  // Nhãn có trong bảng: tìm cụm dài nhất ở cuối.
  for (let k = Math.min(MAX_LABEL_WORDS, words.length); k >= 1; k -= 1) {
    const ws = words.slice(-k)
    const label = text.slice(ws[0]?.start ?? colon, colon)
    const known = lookupLabel(label)
    const prevWord = words[words.length - k - 1]
    const ambiguousBlocked =
      AMBIGUOUS_LABELS.has(normalizeLabel(label)) &&
      prevWord !== undefined &&
      HAS_LETTER_RE.test(prevWord.text)
    if (known && !ambiguousBlocked) {
      return { colon, labelStart: ws[0]?.start ?? colon, label: label.trim(), known }
    }
  }
  // Nhãn lạ: lấy cụm sau dấu phân cách gần nhất.
  const seg = text.slice(segStart, colon)
  const cut = Math.max(
    seg.lastIndexOf("\t"),
    seg.lastIndexOf(";"),
    seg.lastIndexOf(". "),
    seg.lastIndexOf("  ")
  )
  let start = segStart + (cut === -1 ? 0 : cut + 1)
  if (afterValue) {
    const tail = splitWords(text.slice(start, colon), start).slice(-MAX_LABEL_WORDS)
    const firstUpper = tail.find((w) => /^\p{Lu}/u.test(w.text))
    if (!firstUpper) {
      return null
    }
    start = firstUpper.start
  }
  const label = text.slice(start, colon).trim()
  if (!label) {
    return null
  }
  return { colon, labelStart: text.indexOf(label, start), label, known: undefined }
}

const isTabOnly = (p: Para | undefined): boolean =>
  Boolean(p) && p?.text.trim() === "" && (p?.atoms.some((a) => a.kind === "tab") ?? false)

const detectLabels = (d: Detector, paras: Para[], multilineStarts: Set<number>): void => {
  let subject: Subject = "doi_tuong"
  paras.forEach((p, i) => {
    const s = detectSubject(p.text)
    if (s) {
      subject = s
    }
    const text = p.text
    const colons = [...text.matchAll(/:/g)].map((m) => m.index ?? 0).filter((c) => d.isFree(i, c, c + 1))
    const hits: LabelHit[] = []
    let segStart = 0
    for (const c of colons) {
      const hit = findLabelStart(text, segStart, c, hits.length > 0)
      if (hit) {
        hits.push(hit)
      }
      segStart = c + 1
    }
    hits.forEach((hit, k) => {
      const next = hits[k + 1]
      let end = next ? next.labelStart : text.length
      // Không lấn vào vùng đã nhận diện (ngày tháng…).
      for (let pos = hit.colon + 1; pos < end; pos += 1) {
        if (!d.isFree(i, pos, pos + 1)) {
          end = pos
          break
        }
      }
      const label = hit.label
      const norm = normalizeLabel(label)
      if (!norm || isSkippedLabel(label) || (isUpper(label) && !hit.known)) {
        return
      }
      if (!hit.known && label.split(/\s+/).length > 8) {
        return
      }
      const region = text.slice(hit.colon + 1, end)
      const known = hit.known
      const code = known
        ? applySubject(known, subject)
        : toFieldCode(label.replace(/\s+\d{1,2}$/, "")).slice(0, 40)
      if (!code) {
        return
      }
      const isAbsolute = known === "can_bo_ho_ten"
      const finalCode = isAbsolute ? "can_bo_ho_ten" : code
      const type = typeForCode(finalCode, inferType(finalCode))
      const group = groupForCode(finalCode, isAbsolute ? "can_bo" : subject)
      const prettyLabel = label
        .replace(/^[-–•\s]+/, "")
        .replace(/\s*\(\*\)\s*$/, "")
        .replace(/\s+\d{1,2}$/, "")
      const base = { code: finalCode, label: prettyLabel, type, group }

      // Nhãn ở cuối đoạn + các dòng chấm phía dưới → xử lý ở phần nhiều dòng.
      if (!region.trim() && !next && multilineStarts.has(i + 1)) {
        return
      }

      const lead = region.match(LEADING_SPACE_RE)?.[0].length ?? 0
      const valueStart = hit.colon + 1 + lead
      const trimmedRegion = region.trim()

      if (!trimmedRegion) {
        const tabPos = region.indexOf("\t")
        if (tabPos !== -1) {
          const lastTab = region.lastIndexOf("\t")
          d.add({
            ...base,
            suffix: "",
            para: i,
            start: hit.colon + 1 + tabPos,
            end: hit.colon + 1 + lastTab + 1,
            mode: "guard",
            confidence: "high",
          })
        } else if (known) {
          d.add({
            ...base,
            suffix: "",
            para: i,
            start: hit.colon + 1 + region.length,
            end: hit.colon + 1 + region.length,
            mode: "insert",
            confidence: "high",
          })
        }
        return
      }

      // Bắt đầu bằng dấu chấm: "Số: ………/QĐ-CA"
      const dots = /^[.…_]{2,}(?:\s?[.…_]+)*/.exec(trimmedRegion)
      if (dots) {
        d.add({
          ...base,
          suffix: "",
          para: i,
          start: valueStart,
          end: valueStart + dots[0].length,
          mode: "guard",
          confidence: "high",
        })
        return
      }

      // "- Người đại diện (nếu có)" → chèn trước phần ghi chú.
      if (trimmedRegion.startsWith("-") || trimmedRegion.startsWith("(")) {
        if (known) {
          const rep = removeDiacritics(trimmedRegion).toLowerCase().includes("dai dien")
          const repBase = rep
            ? {
                ...base,
                code: "nguoi_dai_dien_ho_ten",
                label: "Người đại diện – họ tên",
                group: "Người bị hại / liên quan",
              }
            : base
          d.add({
            ...repBase,
            suffix: "",
            para: i,
            start: valueStart,
            end: valueStart,
            mode: "insert",
            confidence: "high",
          })
        }
        return
      }

      // Giá trị mẫu đã điền.
      const cut = trimmedRegion.search(DASH_SPLIT_RE)
      let sample = cut === -1 ? trimmedRegion : trimmedRegion.slice(0, cut)
      sample = sample.replace(TRAILING_PUNCT_RE, "")
      if (!sample) {
        return
      }
      const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(sample)
      const numericType = type === "money" || type === "number"
      let valueType: FieldType = dmy ? "date" : type
      if (numericType && !/^[\d.,\s]+$/.test(sample)) {
        valueType = "text"
      }
      const suffix: BlankSuffix = valueType === "text" && isUpper(sample) && sample.length > 1 ? "_hoa" : ""
      d.add({
        ...base,
        type: valueType,
        suffix,
        para: i,
        start: valueStart,
        end: valueStart + sample.length,
        mode: "replace",
        sample,
        confidence: known || sample.length <= 120 ? "high" : "low",
      })
    })
  })
}

/** Ngày dạng 23/07/2026 nằm trong câu văn. */
const detectInlineDates = (d: Detector, paras: Para[]): void => {
  paras.forEach((p, i) => {
    for (const m of p.text.matchAll(DMY_RE)) {
      const s = m.index ?? 0
      const e = s + m[0].length
      if (!d.isFree(i, s, e)) {
        continue
      }
      const before = p.text.slice(Math.max(0, s - 60), s)
      const words = before.trim().split(/\s+/).slice(-3).join(" ")
      const b = removeDiacritics(words).toLowerCase()
      const meaningful = toFieldCode(words).replace(/^ngay_?|_?ngay$/g, "")
      let code = meaningful ? `ngay_${meaningful}`.slice(0, 40) : `ngay_doan_${i}`
      let label = meaningful ? `Ngày – ${words}` : `Ngày (đoạn ${i + 1})`
      let high = false
      if (/tu ngay$/.test(b)) {
        code = "tu_ngay"
        label = "Từ ngày"
        high = true
      } else if (/den ngay$/.test(b)) {
        code = "den_ngay"
        label = "Đến ngày"
        high = true
      }
      d.add({
        code,
        suffix: "",
        label,
        type: "date",
        group: "Vụ việc",
        para: i,
        start: s,
        end: e,
        mode: "replace",
        sample: m[0],
        confidence: high ? "high" : "low",
      })
    }
  })
}

const detectLeftoverDots = (d: Detector, paras: Para[]): void => {
  paras.forEach((p, i) => {
    for (const m of p.text.matchAll(DOTS_RE)) {
      const s = m.index ?? 0
      const e = s + m[0].length
      const dotCount = (m[0].match(/[.…_]/g) ?? []).length
      if (dotCount < 3 || !d.isFree(i, s, e)) {
        continue
      }
      const before = p.text.slice(0, s)
      const seg = before.split(/[\t:;,.]/).pop() ?? ""
      const words = seg.trim().split(/\s+/).filter(Boolean).slice(-4).join(" ")
      const label = words ? words.charAt(0).toUpperCase() + words.slice(1).toLowerCase() : "Chỗ trống"
      const code = toFieldCode(words) || `cho_trong_${i}`
      d.add({
        code: code.slice(0, 40),
        suffix: "",
        label,
        type: "text",
        group: "Khác",
        para: i,
        start: s,
        end: e,
        mode: "guard",
        confidence: "low",
      })
    }
  })
}

/** Nhóm các dòng chỉ có Tab (dòng chấm) liên tiếp. */
const findMultilineGroups = (paras: Para[]): number[][] => {
  const groups: number[][] = []
  let current: number[] = []
  paras.forEach((p, i) => {
    if (isTabOnly(p)) {
      current.push(i)
    } else if (current.length) {
      groups.push(current)
      current = []
    }
  })
  if (current.length) {
    groups.push(current)
  }
  return groups
}

const multilineLabel = (prev: string): { code: string; label: string } | null => {
  const t = prev.trim()
  if (!t.endsWith(":")) {
    return null
  }
  const raw = t
    .slice(0, -1)
    .replace(/\(\*\)/g, "")
    .trim()
  const n = removeDiacritics(raw).toLowerCase()
  if (n.includes("cam ket") || n.includes("cam doan")) {
    return { code: "noi_dung_cam_ket", label: "Nội dung cam kết" }
  }
  if (n.includes("tuong trinh")) {
    return { code: "noi_dung_tuong_trinh", label: "Nội dung tường trình" }
  }
  const lastSeg = raw.split(/[\t.]/).pop()?.trim() ?? raw
  return { code: toFieldCode(lastSeg).slice(0, 40) || "noi_dung", label: lastSeg }
}

const detectMultiline = (d: Detector, paras: Para[], groups: number[][]): void => {
  for (const g of groups) {
    const first = g[0]
    if (first === undefined) {
      continue
    }
    const prev = paras[first - 1]
    const prevOwnBlank = prev ? (prev.text.split(":").pop() ?? "").includes("\t") : false
    const named = prev && !(prevOwnBlank && g.length < 2) ? multilineLabel(prev.text) : null
    if (!named && g.length < 2) {
      continue
    }
    const info = named ?? { code: `noi_dung_ghi_them_${first}`, label: "Nội dung ghi thêm" }
    const para = paras[first]
    if (!para) {
      continue
    }
    d.add({
      code: info.code,
      suffix: "",
      label: info.label,
      type: "textarea",
      group: "Vụ việc",
      para: first,
      start: 0,
      end: para.text.length,
      mode: "guard",
      confidence: named ? "high" : "low",
      lines: g.slice(1),
    })
  }
}

/** Cùng mã nhưng mẫu khác nhau ở hai chỗ (vd: hai cán bộ) → tách thành _2, _3. */
const NO_DEDUPE = new Set(["ten_don_vi", "ten_co_quan_cap_tren", "dia_danh", "ngay_lap", "kinh_gui"])

const dedupe = (blanks: Blank[]): void => {
  const samples = new Map<string, string[]>()
  for (const b of blanks) {
    if (!b.sample || !(b.suffix === "" || b.suffix === "_hoa") || NO_DEDUPE.has(b.code)) {
      continue
    }
    const key = b.code
    const list = samples.get(key) ?? []
    const norm = b.sample.toLowerCase()
    const idx = list.indexOf(norm)
    if (idx === -1) {
      list.push(norm)
      samples.set(key, list)
      if (list.length > 1) {
        b.code = `${key}_${list.length}`
        b.label = `${b.label} (${list.length})`
      }
    } else if (idx > 0) {
      b.code = `${key}_${idx + 1}`
      b.label = `${b.label} (${idx + 1})`
    }
  }
}

const TAG_RE = /\{[#^/]?[a-z][a-z0-9_]*\}/

export const analyzeBlanks = (buffer: ArrayBuffer): BlankAnalysis => {
  const zip = new PizZip(buffer)
  const xml = zip.file("word/document.xml")?.asText()
  if (!xml) {
    throw new Error("Không đọc được nội dung file Word.")
  }
  const doc = new DOMParser().parseFromString(xml, "text/xml")
  const paras = readParagraphs(doc)
  const hasTags = paras.some((p) => TAG_RE.test(p.text))

  const d = new Detector(paras)
  const groups = findMultilineGroups(paras)

  detectHeaderUnits(d, paras, findTitleIndex(paras))
  detectSignatures(d, paras)
  detectDates(d, paras)
  detectTimes(d, paras)
  detectOpeningLine(d, paras)
  detectMultiline(d, paras, groups)
  const multilineStarts = new Set(d.blanks.filter((b) => b.lines).map((b) => b.para))
  detectLabels(d, paras, multilineStarts)
  detectInlineDates(d, paras)
  detectLeftoverDots(d, paras)

  const blanks = d.blanks.sort((a, b) => a.para - b.para || a.start - b.start)
  dedupe(blanks)

  return {
    paragraphs: paras.map((p, index) => ({ index, text: p.text })),
    blanks,
    hasTags,
  }
}

/* ------------------------------------------------------------------ */
/* Chuyển thành thẻ                                                     */
/* ------------------------------------------------------------------ */

type Op = { pos: number; kind: "del"; end: number } | { pos: number; kind: "ins"; text: string }

const setText = (doc: XmlDocument, t: XmlElement, value: string): void => {
  while (t.firstChild) {
    t.removeChild(t.firstChild)
  }
  t.appendChild(doc.createTextNode(value))
  t.setAttribute("xml:space", "preserve")
}

const newT = (doc: XmlDocument, value: string): XmlElement => {
  const t = doc.createElement("w:t")
  setText(doc, t, value)
  return t
}

/** Chèn chữ vào vị trí pos của đoạn văn. */
const insertAt = (doc: XmlDocument, p: Para, pos: number, value: string): void => {
  // Ưu tiên chèn vào một w:t chứa vị trí đó.
  for (let k = 0; k < p.atoms.length; k += 1) {
    const a = p.atoms[k]
    const s = p.starts[k] ?? 0
    if (a?.kind === "text" && pos >= s && pos <= s + a.text.length) {
      const off = pos - s
      a.text = a.text.slice(0, off) + value + a.text.slice(off)
      setText(doc, a.node, a.text)
      return
    }
  }
  // Không có w:t: tạo mới cạnh dấu tab.
  const k = p.atoms.findIndex((a, idx) => (p.starts[idx] ?? 0) >= pos)
  if (k !== -1) {
    const tab = p.atoms[k]?.node
    tab?.parentNode?.insertBefore(newT(doc, value), tab)
    return
  }
  const last = p.atoms.at(-1)?.node
  if (last?.parentNode) {
    last.parentNode.insertBefore(newT(doc, value), last.nextSibling)
    return
  }
  // Đoạn trống hoàn toàn.
  const r = doc.createElement("w:r")
  r.appendChild(newT(doc, value))
  p.el.appendChild(r)
}

const deleteRange = (doc: XmlDocument, p: Para, start: number, end: number): void => {
  for (let k = p.atoms.length - 1; k >= 0; k -= 1) {
    const a = p.atoms[k]
    const s = p.starts[k] ?? 0
    if (!a) {
      continue
    }
    const e = s + a.text.length
    if (e <= start || s >= end) {
      continue
    }
    if (a.kind === "tab") {
      a.node.parentNode?.removeChild(a.node)
      continue
    }
    const from = Math.max(start, s) - s
    const to = Math.min(end, e) - s
    a.text = a.text.slice(0, from) + a.text.slice(to)
    setText(doc, a.node, a.text)
  }
}

const tagFor = (b: Blank): string => `${b.code}${b.suffix}`

const opsFor = (b: Blank): Op[] => {
  const tag = tagFor(b)
  if (b.mode === "replace") {
    return [
      { pos: b.start, kind: "del", end: b.end },
      { pos: b.start, kind: "ins", text: `{${tag}}` },
    ]
  }
  if (b.mode === "insert") {
    return [{ pos: b.start, kind: "ins", text: ` {${tag}}` }]
  }
  const lead = b.pad ? `{#${tag}} {/${tag}}` : ""
  return [
    { pos: b.end, kind: "ins", text: `{/${tag}}` },
    { pos: b.start, kind: "ins", text: `${lead}{${tag}}{^${tag}}` },
  ]
}

const cloneParaWithText = (doc: XmlDocument, template: XmlElement, value: string): XmlElement => {
  const p = doc.createElement("w:p")
  for (let c = template.firstChild; c; c = c.nextSibling) {
    if (isElement(c) && c.nodeName === "w:pPr") {
      p.appendChild(c.cloneNode(true))
    }
  }
  const r = doc.createElement("w:r")
  r.appendChild(newT(doc, value))
  p.appendChild(r)
  return p
}

export interface ConvertResult {
  buffer: ArrayBuffer
  /** Thẻ có phần dấu chấm giữ lại khi trống (không in thêm "……"). */
  guarded: string[]
}

/** Áp các chỗ điền đã chọn vào file Word. */
export const convertBlanks = (buffer: ArrayBuffer, blanks: Blank[]): ConvertResult => {
  const zip = new PizZip(buffer)
  const xml = zip.file("word/document.xml")?.asText() ?? ""
  const doc = new DOMParser().parseFromString(xml, "text/xml")
  const paras = readParagraphs(doc)
  const guarded = new Set<string>()

  const byPara = new Map<number, Op[]>()
  for (const b of blanks) {
    const list = byPara.get(b.para) ?? []
    list.push(...opsFor(b))
    byPara.set(b.para, list)
    if (b.mode === "guard") {
      guarded.add(tagFor(b))
    }
  }

  for (const [pi, ops] of byPara) {
    const p = paras[pi]
    if (!p) {
      continue
    }
    // Từ cuối lên đầu để vị trí phía trước không bị lệch; cùng vị trí: xóa trước, chèn sau.
    ops.sort((a, b) => b.pos - a.pos || (a.kind === "del" ? -1 : 1))
    for (const op of ops) {
      if (op.kind === "del") {
        deleteRange(doc, p, op.pos, op.end)
      } else {
        insertAt(doc, p, op.pos, op.text)
      }
    }
  }

  // Nhiều dòng chấm: các dòng 2..n chỉ hiện khi để trống.
  for (const b of blanks) {
    const lines = b.lines ?? []
    const firstLine = lines[0]
    const lastLine = lines.at(-1)
    if (firstLine === undefined || lastLine === undefined) {
      continue
    }
    const first = paras[firstLine]?.el
    const last = paras[lastLine]?.el
    if (!(first && last && first.parentNode && last.parentNode)) {
      continue
    }
    const tag = tagFor(b)
    first.parentNode.insertBefore(cloneParaWithText(doc, first, `{^${tag}}`), first)
    last.parentNode.insertBefore(cloneParaWithText(doc, last, `{/${tag}}`), last.nextSibling)
  }

  zip.file("word/document.xml", new XMLSerializer().serializeToString(doc))
  const out = zip.generate({ type: "arraybuffer", compression: "DEFLATE" }) as ArrayBuffer
  return { buffer: out, guarded: [...guarded] }
}

/** Đổi cả đoạn văn thành một ô nhập (đoạn văn dài, ví dụ phần nội dung). */
export const paragraphBlank = (
  analysis: BlankAnalysis,
  para: number,
  label: string,
  id: string
): Blank | null => {
  const p = analysis.paragraphs[para]
  if (!p?.text.trim()) {
    return null
  }
  const start = p.text.length - p.text.trimStart().length
  const end = p.text.trimEnd().length
  return {
    id,
    para,
    start,
    end,
    mode: "replace",
    code: toFieldCode(label).slice(0, 40) || `doan_van_${para}`,
    suffix: "",
    label,
    type: "textarea",
    group: "Vụ việc",
    sample: p.text.slice(start, end),
    confidence: "high",
  }
}

export const isDigitsOnly = (s: string): boolean => DIGITS_RE.test(s)
export { toIsoDate }
