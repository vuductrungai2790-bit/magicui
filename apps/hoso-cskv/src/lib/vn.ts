/**
 * Tiện ích định dạng tiếng Việt: đọc số thành chữ, ngày tháng, giờ, viết hoa,
 * bỏ dấu để tạo mã trường / tên file.
 */

const DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"] as const

const UNITS = ["", "nghìn", "triệu", "tỷ"] as const

const digitWord = (d: number): string => DIGITS[d] ?? ""

const readUnitsAfterTens = (tens: number, units: number): string => {
  if (units === 0) {
    return ""
  }
  if (units === 5) {
    return "lăm"
  }
  if (units === 1 && tens > 1) {
    return "mốt"
  }
  if (units === 4 && tens > 1) {
    return "tư"
  }
  return digitWord(units)
}

/** Đọc một nhóm 3 chữ số. `full` = bắt buộc đọc đủ "không trăm", "linh". */
const readTriple = (value: number, full: boolean): string => {
  const hundreds = Math.floor(value / 100)
  const tens = Math.floor((value % 100) / 10)
  const units = value % 10
  const words: string[] = []

  if (full || hundreds > 0) {
    words.push(digitWord(hundreds), "trăm")
  }

  if (tens === 0) {
    if (units > 0) {
      if (full || hundreds > 0) {
        words.push("linh")
      }
      words.push(digitWord(units))
    }
  } else if (tens === 1) {
    words.push("mười")
    const u = readUnitsAfterTens(1, units)
    if (u) {
      words.push(u)
    }
  } else {
    words.push(digitWord(tens), "mươi")
    const u = readUnitsAfterTens(tens, units)
    if (u) {
      words.push(u)
    }
  }

  return words.join(" ")
}

const unitName = (index: number): string => {
  // index: 0 = đơn vị, 1 = nghìn, 2 = triệu, 3 = tỷ, 4 = nghìn tỷ, 5 = triệu tỷ…
  if (index === 0) {
    return ""
  }
  const base = UNITS[((index - 1) % 3) + 1] ?? ""
  const billions = Math.floor((index - 1) / 3)
  return [base, ...Array.from({ length: billions }, () => "tỷ")].filter(Boolean).join(" ")
}

/** Đọc số nguyên không âm thành chữ (chữ thường). */
export const numberToWords = (input: number): string => {
  if (!Number.isFinite(input)) {
    return ""
  }
  const n = Math.floor(Math.abs(input))
  if (n === 0) {
    return "không"
  }

  const groups: number[] = []
  let rest = n
  while (rest > 0) {
    groups.push(rest % 1000)
    rest = Math.floor(rest / 1000)
  }

  const parts: string[] = []
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const g = groups[i] ?? 0
    if (g > 0) {
      const isHighest = i === groups.length - 1
      parts.push(readTriple(g, !isHighest))
      const unit = unitName(i)
      if (unit) {
        parts.push(unit)
      }
    }
  }

  const text = parts.join(" ").replace(/\s+/g, " ").trim()
  return input < 0 ? `âm ${text}` : text
}

export const capitalizeFirst = (text: string): string =>
  text ? `${text.charAt(0).toLocaleUpperCase("vi")}${text.slice(1)}` : text

/** 1500000 → "Một triệu năm trăm nghìn đồng" */
export const moneyToWords = (value: number): string => `${capitalizeFirst(numberToWords(value))} đồng`

/** 1500000 → "1.500.000" */
export const formatNumber = (value: number): string =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value)

/** Bỏ dấu cách, dấu chấm phân tách hàng nghìn → number. */
export const parseNumber = (raw: string): number | null => {
  const cleaned = raw.replace(/[.\s]/g, "").replace(",", ".")
  if (!cleaned) {
    return null
  }
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

const pad2 = (n: number): string => String(n).padStart(2, "0")

export interface DateParts {
  day: number
  month: number
  year: number
}

/** "2026-11-23" → {day, month, year} */
export const parseIsoDate = (iso: string): DateParts | null => {
  const m = ISO_DATE.exec(iso)
  if (!m) {
    return null
  }
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
}
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_RE = /^(\d{1,2}):(\d{2})/

/**
 * Theo thể thức văn bản hành chính: ngày dưới 10 và tháng 1, 2 thêm số 0 phía trước.
 */
export const officialDay = (day: number): string => pad2(day)
export const officialMonth = (month: number): string => (month <= 2 ? pad2(month) : String(month))

/** → "ngày 05 tháng 3 năm 2026" */
export const dateToWords = (iso: string): string => {
  const p = parseIsoDate(iso)
  if (!p) {
    return ""
  }
  return `ngày ${officialDay(p.day)} tháng ${officialMonth(p.month)} năm ${p.year}`
}

/** → "05/03/2026" */
export const formatDate = (iso: string): string => {
  const p = parseIsoDate(iso)
  return p ? `${pad2(p.day)}/${pad2(p.month)}/${p.year}` : iso
}

/** "14:30" → "14 giờ 30 phút" */
export const timeToWords = (time: string): string => {
  const m = TIME_RE.exec(time)
  if (!m) {
    return ""
  }
  return `${pad2(Number(m[1]))} giờ ${pad2(Number(m[2]))} phút`
}

export const parseTime = (time: string): { hour: string; minute: string } | null => {
  const m = TIME_RE.exec(time)
  return m ? { hour: pad2(Number(m[1])), minute: m[2] ?? "00" } : null
}

export const todayIso = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export const nowTime = (): string => {
  const d = new Date()
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

const COMBINING_MARKS = /[̀-ͯ]/g
const NON_CODE_CHARS = /[^a-z0-9]+/g
const EDGE_UNDERSCORES = /^_+|_+$/g
const UNSAFE_FILENAME = /[\\/:*?"<>|]+/g

/** Bỏ dấu tiếng Việt. */
export const removeDiacritics = (text: string): string =>
  text.normalize("NFD").replace(COMBINING_MARKS, "").replace(/đ/g, "d").replace(/Đ/g, "D")

/** "Họ và tên" → "ho_va_ten" */
export const toFieldCode = (text: string): string =>
  removeDiacritics(text).toLowerCase().replace(NON_CODE_CHARS, "_").replace(EDGE_UNDERSCORES, "")

export const safeFileName = (name: string): string =>
  name.replace(UNSAFE_FILENAME, "-").replace(/\s+/g, " ").trim().slice(0, 120)

export const formatDateTime = (ms: number): string =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(ms)
