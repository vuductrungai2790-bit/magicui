export const FIELD_TYPES = [
  "text",
  "textarea",
  "date",
  "time",
  "number",
  "money",
  "select",
  "boolean",
  "cccd",
  "phone",
  "table",
] as const

export type FieldType = (typeof FIELD_TYPES)[number]

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Chữ (một dòng)",
  textarea: "Đoạn văn",
  date: "Ngày tháng",
  time: "Giờ phút",
  number: "Số",
  money: "Số tiền",
  select: "Danh sách chọn",
  boolean: "Có / Không",
  cccd: "Số định danh (12 số)",
  phone: "Số điện thoại",
  table: "Bảng nhiều dòng",
}

/** Cột của trường kiểu bảng (vd: danh sách tang vật). */
export interface ColumnDef {
  code: string
  label: string
  type: Exclude<FieldType, "table" | "boolean" | "textarea">
}

export interface FieldDef {
  /** Mã trường – trùng với thẻ {ma_truong} trong file Word. */
  code: string
  label: string
  type: FieldType
  group: string
  required: boolean
  options?: string[]
  defaultValue?: string
  hint?: string
  columns?: ColumnDef[]
  /** Thứ tự hiển thị trong nhóm. */
  order: number
  /** Trường hệ thống tự thêm khi nhận diện mẫu – người dùng nên rà soát. */
  autoDetected?: boolean
}

/** Cấu trúc thẻ đọc được từ file Word. */
export interface TemplateTags {
  /** Thẻ đơn {ten}. */
  simple: string[]
  /** Khối {#ten}…{/ten} – điều kiện hoặc bảng lặp. */
  sections: { name: string; children: string[] }[]
}

export interface TemplateRecord {
  id: string
  name: string
  description: string
  fileName: string
  file: Blob
  tags: TemplateTags
  /** Mã các trường (đã quy về trường gốc) mà mẫu sử dụng. */
  fieldCodes: string[]
  version: number
  createdAt: number
  updatedAt: number
}

export interface DossierComponent {
  templateId: string
  /** Mã trường Có/Không quyết định có đưa thành phần này vào bộ hồ sơ hay không. */
  conditionField?: string
}

export interface DossierType {
  id: string
  name: string
  description: string
  category: string
  components: DossierComponent[]
  /** Số ngày phải hoàn thành kể từ ngày lập (để nhắc hạn), 0 = không nhắc. */
  deadlineDays: number
  createdAt: number
  updatedAt: number
}

export type TableRow = Record<string, string> & { _id: string }
export type FieldValue = string | boolean | TableRow[]
export type DossierData = Record<string, FieldValue>

export type DossierStatus = "draft" | "done"

export interface Dossier {
  id: string
  typeId: string
  title: string
  status: DossierStatus
  data: DossierData
  deadline?: string
  createdAt: number
  updatedAt: number
}

export interface SettingRecord {
  key: string
  value: unknown
}
