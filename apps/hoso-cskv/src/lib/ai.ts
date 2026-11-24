/**
 * Kết nối Claude (Anthropic) để soạn nội dung và tự điền thông tin.
 * Gọi thẳng từ trình duyệt bằng khóa API người dùng nhập trong Cài đặt.
 * Khi chưa có khóa: tạo sẵn câu lệnh để dán vào claude.ai.
 */
import Anthropic from "@anthropic-ai/sdk"

import { getSetting, saveSetting } from "./db"
import type { FieldDef } from "./types"
import { formatDate, parseIsoDate } from "./vn"

export interface AiSettings {
  enabled: boolean
  apiKey: string
  model: string
}

export const AI_KEY = "claude"
export const DEFAULT_AI: AiSettings = { enabled: true, apiKey: "", model: "claude-opus-5-5" }

export const AI_MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 – chất lượng cao nhất (mặc định)" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 – nhanh, chi phí thấp hơn" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 – nhanh nhất, rẻ nhất" },
] as const

export const getAiSettings = (): Promise<AiSettings> => getSetting(AI_KEY, DEFAULT_AI)
export const saveAiSettings = (s: AiSettings): Promise<void> => saveSetting(AI_KEY, s)

const SYSTEM = `Bạn là trợ lý soạn thảo văn bản cho cán bộ Cảnh sát khu vực thuộc Công an phường/xã ở Việt Nam.
Yêu cầu khi soạn:
- Viết tiếng Việt chuẩn, văn phong hành chính – công vụ: ngắn gọn, rõ ràng, khách quan, đúng thuật ngữ nghiệp vụ.
- Tuân thủ thể thức Nghị định 30/2020/NĐ-CP: viết hoa đúng quy định; ngày tháng dạng "ngày 05 tháng 3 năm 2026" (ngày dưới 10 và tháng 1, 2 thêm số 0); số tiền dạng "1.500.000 đồng".
- Chỉ dùng thông tin được cung cấp. Không tự bịa họ tên, số hiệu văn bản, ngày tháng hay điều luật. Thông tin còn thiếu thì để "……".
- Không thêm lời chào, giải thích hay ghi chú ngoài nội dung được yêu cầu.`

const STRUCTURED_HINT: Partial<Record<FieldDef["type"], string>> = {
  date: " (định dạng YYYY-MM-DD)",
  time: " (định dạng HH:MM, 24 giờ)",
  money: " (chỉ ghi số, không dấu chấm, ví dụ 1500000)",
  number: " (chỉ ghi số)",
  cccd: " (12 chữ số)",
  phone: " (chỉ ghi số)",
  boolean: ' (ghi "có" hoặc "không")',
}

export class AiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AiError"
  }
}

const explain = (error: unknown): AiError => {
  if (error instanceof AiError) {
    return error
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return new AiError("Khóa API không đúng hoặc đã bị thu hồi. Kiểm tra lại trong Cài đặt.")
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return new AiError("Khóa API không có quyền dùng mô hình này.")
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AiError("Đang gửi quá nhiều yêu cầu hoặc tài khoản hết hạn mức. Thử lại sau ít phút.")
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new AiError("Không kết nối được tới Claude. Kiểm tra kết nối Internet.")
  }
  if (error instanceof Anthropic.APIError) {
    return new AiError(`Claude báo lỗi (${error.status ?? "?"}): ${error.message}`)
  }
  return new AiError(error instanceof Error ? error.message : "Đã xảy ra lỗi khi gọi Claude")
}

const client = (s: AiSettings): Anthropic => {
  if (!s.apiKey.trim()) {
    throw new AiError("Chưa nhập khóa API Claude trong Cài đặt.")
  }
  return new Anthropic({ apiKey: s.apiKey.trim(), dangerouslyAllowBrowser: true })
}

/** Haiku không hỗ trợ chuyển mô hình khi bị từ chối; các mô hình khác dùng chế độ mặc định. */
const fallbackParams = (model: string) =>
  model.startsWith("claude-haiku")
    ? {}
    : {
        betas: ["server-side-fallback-2026-07-01"] as Anthropic.Beta.AnthropicBeta[],
        fallbacks: "default" as const,
      }

const textOf = (msg: Anthropic.Beta.BetaMessage): string =>
  msg.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim()

const checkStop = (msg: Anthropic.Beta.BetaMessage): void => {
  if (msg.stop_reason === "refusal") {
    throw new AiError("Claude từ chối yêu cầu này. Hãy diễn đạt lại nội dung cần soạn.")
  }
}

/* ------------------------------ Dữ liệu đầu vào ------------------------------ */

export interface ContextItem {
  label: string
  value: string
}

/** Dữ liệu hồ sơ đã nhập → danh sách "nhãn: giá trị" dễ đọc. */
export const describeData = (fields: FieldDef[], data: Record<string, unknown>): ContextItem[] => {
  const out: ContextItem[] = []
  for (const f of fields) {
    const v = data[f.code]
    if (f.type === "table" && Array.isArray(v) && v.length) {
      const rows = v.map(
        (r, i) =>
          `${i + 1}. ${(f.columns ?? []).map((c) => `${c.label}: ${(r as Record<string, string>)[c.code] ?? ""}`).join("; ")}`
      )
      out.push({ label: f.label, value: rows.join("\n") })
    } else if (typeof v === "boolean") {
      out.push({ label: f.label, value: v ? "Có" : "Không" })
    } else if (typeof v === "string" && v.trim()) {
      out.push({ label: f.label, value: f.type === "date" && parseIsoDate(v) ? formatDate(v) : v.trim() })
    }
  }
  return out
}

const formatContext = (items: ContextItem[]): string =>
  items.length ? items.map((i) => `- ${i.label}: ${i.value}`).join("\n") : "(chưa có)"

/* ------------------------------ Soạn nội dung ------------------------------ */

export interface DraftRequest {
  dossierType: string
  documents: string[]
  fieldLabel: string
  example?: string
  current?: string
  notes: string
  context: ContextItem[]
}

export const buildDraftPrompt = (r: DraftRequest): string =>
  [
    `Hãy soạn nội dung cho mục “${r.fieldLabel}” trong hồ sơ “${r.dossierType}”.`,
    `Nội dung này sẽ được điền vào: ${r.documents.join("; ") || "văn bản của hồ sơ"}.`,
    "",
    "Thông tin hồ sơ đã có:",
    formatContext(r.context),
    r.example
      ? `\nĐoạn mẫu trong biểu mẫu (tham khảo văn phong, KHÔNG chép lại thông tin của người khác):\n"""${r.example}"""`
      : "",
    r.current ? `\nNội dung hiện tại (có thể sửa, bổ sung):\n"""${r.current}"""` : "",
    r.notes.trim() ? `\nYêu cầu / ý chính của cán bộ:\n${r.notes.trim()}` : "",
    "",
    "Chỉ trả về đúng phần nội dung để điền vào văn bản, không kèm tiêu đề mục.",
  ]
    .filter((l) => l !== "")
    .join("\n")

export const draftText = async (
  s: AiSettings,
  r: DraftRequest,
  onText: (snapshot: string) => void
): Promise<string> => {
  try {
    const stream = client(s).beta.messages.stream({
      model: s.model,
      max_tokens: 16_000,
      system: SYSTEM,
      output_config: { effort: "medium" },
      messages: [{ role: "user", content: buildDraftPrompt(r) }],
      ...fallbackParams(s.model),
    })
    stream.on("text", (_delta, snapshot) => onText(snapshot))
    const msg = await stream.finalMessage()
    checkStop(msg)
    return textOf(msg)
  } catch (e) {
    throw explain(e)
  }
}

/* ------------------------------ Tự điền thông tin ------------------------------ */

export interface ExtractRequest {
  text: string
  fields: FieldDef[]
}

const extractable = (fields: FieldDef[]): FieldDef[] => fields.filter((f) => f.type !== "table")

export const buildExtractPrompt = (r: ExtractRequest, forCopy = false): string => {
  const list = extractable(r.fields)
    .map(
      (f) =>
        `- ${f.code}: ${f.label}${STRUCTURED_HINT[f.type] ?? ""}${f.options?.length ? ` – chọn một trong: ${f.options.join(", ")}` : ""}`
    )
    .join("\n")
  return [
    "Đọc văn bản dưới đây và lấy ra thông tin cho các trường của hồ sơ.",
    "Trường nào văn bản không nêu thì để chuỗi rỗng. Không suy đoán.",
    "",
    "Danh sách trường (mã: tên):",
    list,
    "",
    "Văn bản:",
    `"""${r.text.trim()}"""`,
    forCopy ? '\nChỉ trả lời bằng một đối tượng JSON {"mã_trường": "giá trị", ...}, không giải thích.' : "",
  ].join("\n")
}

const normalizeValue = (f: FieldDef, raw: string): string | boolean | null => {
  const v = raw.trim()
  if (!v) {
    return null
  }
  if (f.type === "boolean") {
    return /^(có|co|yes|true|1)$/i.test(v)
  }
  if (f.type === "date") {
    const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v)
    if (dmy) {
      return `${dmy[3]}-${dmy[2]?.padStart(2, "0")}-${dmy[1]?.padStart(2, "0")}`
    }
    return parseIsoDate(v) ? v : null
  }
  if (f.type === "money" || f.type === "number" || f.type === "cccd" || f.type === "phone") {
    const digits = v.replace(/[^\d]/g, "")
    return digits || null
  }
  return v
}

/** JSON trả về (từ API hoặc người dùng dán vào) → giá trị đã chuẩn hóa theo kiểu trường. */
export const normalizeExtracted = (
  fields: FieldDef[],
  obj: Record<string, unknown>
): Record<string, string | boolean> => {
  const out: Record<string, string | boolean> = {}
  for (const f of extractable(fields)) {
    const raw = obj[f.code]
    if (typeof raw !== "string" && typeof raw !== "number" && typeof raw !== "boolean") {
      continue
    }
    const v = normalizeValue(f, String(raw))
    if (v !== null) {
      out[f.code] = v
    }
  }
  return out
}

const JSON_BLOCK = /\{[\s\S]*\}/

export const parseLooseJson = (text: string): Record<string, unknown> => {
  const m = JSON_BLOCK.exec(text)
  if (!m) {
    throw new AiError("Không tìm thấy dữ liệu JSON trong nội dung dán vào.")
  }
  try {
    return JSON.parse(m[0]) as Record<string, unknown>
  } catch {
    throw new AiError("Dữ liệu JSON không hợp lệ.")
  }
}

export const extractValues = async (
  s: AiSettings,
  r: ExtractRequest
): Promise<Record<string, string | boolean>> => {
  const fields = extractable(r.fields)
  const schema = {
    type: "object",
    properties: Object.fromEntries(
      fields.map((f) => [
        f.code,
        { type: "string", description: `${f.label}${STRUCTURED_HINT[f.type] ?? ""}` },
      ])
    ),
    required: fields.map((f) => f.code),
    additionalProperties: false,
  }
  try {
    const stream = client(s).beta.messages.stream({
      model: s.model,
      max_tokens: 16_000,
      system: SYSTEM,
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      messages: [{ role: "user", content: buildExtractPrompt(r) }],
      ...fallbackParams(s.model),
    })
    const msg = await stream.finalMessage()
    checkStop(msg)
    return normalizeExtracted(fields, parseLooseJson(textOf(msg)))
  } catch (e) {
    throw explain(e)
  }
}

export const testConnection = async (s: AiSettings): Promise<string> => {
  try {
    const msg = await client(s).beta.messages.create({
      model: s.model,
      max_tokens: 2048,
      output_config: { effort: "low" },
      messages: [{ role: "user", content: "Trả lời đúng một từ: Sẵn sàng" }],
    })
    checkStop(msg)
    return textOf(msg)
  } catch (e) {
    throw explain(e)
  }
}
