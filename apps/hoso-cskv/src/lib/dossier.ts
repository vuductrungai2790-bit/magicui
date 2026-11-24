import JSZip from "jszip"

import { db, getUnitDefaults, newId } from "./db"
import { buildRenderData, isComponentIncluded, renderTemplate } from "./docx"
import { sortFields, UNIT_GROUP } from "./fields"
import type { Dossier, DossierData, DossierType, FieldDef, TemplateRecord } from "./types"
import { nowTime, safeFileName, todayIso } from "./vn"

export const CATEGORIES = [
  "Xử lý vi phạm hành chính",
  "Biện pháp xử lý hành chính",
  "Tin báo, đơn thư, vụ việc",
  "Quản lý người thi hành án, sau cai",
  "Cư trú",
  "Kiểm tra cơ sở, ngành nghề",
  "Vũ khí, vật liệu nổ, công cụ hỗ trợ",
  "Báo cáo định kỳ",
  "Khác",
] as const

export const STATUS_LABEL: Record<Dossier["status"], string> = {
  draft: "Đang lập",
  done: "Hoàn thành",
}

export interface ResolvedComponent {
  /** Mã biểu mẫu (dùng làm khóa và để bỏ / thêm khỏi hồ sơ). */
  key: string
  index: number
  template: TemplateRecord | undefined
  conditionField?: string
  /** Người dùng có chọn đưa văn bản này vào hồ sơ không. */
  enabled: boolean
  /** Thêm riêng cho hồ sơ này (không thuộc loại hồ sơ). */
  extra: boolean
  /** Được chọn và thỏa điều kiện → sẽ được tạo. */
  included: boolean
}

export interface ComponentSelection {
  excluded?: string[]
  extra?: string[]
}

export const resolveComponents = (
  type: DossierType,
  templates: Map<string, TemplateRecord>,
  data: DossierData,
  selection: ComponentSelection = {}
): ResolvedComponent[] => {
  const excluded = new Set(selection.excluded ?? [])
  const base: ResolvedComponent[] = type.components.map((c, index) => {
    const enabled = !excluded.has(c.templateId)
    return {
      key: c.templateId,
      index,
      template: templates.get(c.templateId),
      conditionField: c.conditionField,
      enabled,
      extra: false,
      included: enabled && isComponentIncluded(c, data),
    }
  })
  const inType = new Set(type.components.map((c) => c.templateId))
  const extras: ResolvedComponent[] = (selection.extra ?? [])
    .filter((id) => !inType.has(id) && templates.has(id))
    .map((id, j) => ({
      key: id,
      index: base.length + j,
      template: templates.get(id),
      enabled: true,
      extra: true,
      included: true,
    }))
  return [...base, ...extras]
}

/** Danh sách trường của các văn bản đang được đưa vào hồ sơ (mỗi trường một lần). */
export const collectFieldsFor = (
  type: DossierType,
  components: ResolvedComponent[],
  dictionary: Map<string, FieldDef>
): FieldDef[] => {
  const codes = new Set<string>()
  for (const c of type.components) {
    if (c.conditionField) {
      codes.add(c.conditionField)
    }
  }
  for (const c of components) {
    if (c.included) {
      for (const code of c.template?.fieldCodes ?? []) {
        codes.add(code)
      }
    }
  }
  const defs = [...codes].map((code) => dictionary.get(code)).filter((d): d is FieldDef => Boolean(d))
  return sortFields(defs)
}

/**
 * Danh sách trường cần nhập cho loại hồ sơ (gộp từ tất cả thành phần, mỗi trường một lần).
 * `data` = null: lấy trường của mọi thành phần.
 */
export const collectFields = (
  type: DossierType,
  templates: Map<string, TemplateRecord>,
  dictionary: Map<string, FieldDef>,
  data: DossierData | null
): FieldDef[] => {
  const components = resolveComponents(type, templates, data ?? {}).map((c) =>
    data ? c : { ...c, included: true }
  )
  return collectFieldsFor(type, components, dictionary)
}

/** Mã trường → các văn bản dùng trường đó. */
export const fieldUsage = (components: ResolvedComponent[]): Map<string, ResolvedComponent[]> => {
  const map = new Map<string, ResolvedComponent[]>()
  for (const c of components) {
    if (!c.included) {
      continue
    }
    for (const code of c.template?.fieldCodes ?? []) {
      const list = map.get(code) ?? []
      list.push(c)
      map.set(code, list)
    }
  }
  return map
}

/** Giá trị ví dụ lấy từ các mẫu đã điền sẵn. */
export const collectExamples = (components: ResolvedComponent[]): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const c of components) {
    for (const [code, v] of Object.entries(c.template?.examples ?? {})) {
      out[code] ??= v
    }
  }
  return out
}

const ABBREVIATIONS: [RegExp, string][] = [
  [/^quyết định\s+/i, "QĐ "],
  [/^biên bản\s+/i, "BB "],
  [/^thông báo\s+/i, "TB "],
  [/^báo cáo\s+/i, "BC "],
  [/^giấy\s+/i, "Giấy "],
  [/^công văn\s+/i, "CV "],
]
const LEADING_NUMBER = /^\d+\s*[-.–)]\s*/
const FORM_CODE = /\bmẫu\s+([\p{L}\d.]+)/iu

/** Tên ngắn của văn bản để ghi cạnh ô nhập: "QĐ phân công cán bộ… · CĐ1" */
export const shortTemplateName = (name: string): string => {
  let n = name.replace(/\s*\(minh họa\)\s*$/, "").replace(LEADING_NUMBER, "")
  const form = FORM_CODE.exec(n)?.[1]
  n = n.replace(/\s*[-–]?\s*mẫu\s+[\p{L}\d.]+\s*$/iu, "")
  for (const [re, abbr] of ABBREVIATIONS) {
    if (re.test(n)) {
      n = n.replace(re, abbr)
      break
    }
  }
  const words = n.split(/\s+/)
  const short = words.length > 6 ? `${words.slice(0, 6).join(" ")}…` : n
  return form ? `${short} · ${form}` : short
}

const addDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export const createDossier = async (typeId: string): Promise<string> => {
  const [type, templates, fields, unit] = await Promise.all([
    db.dossierTypes.get(typeId),
    db.templates.toArray(),
    db.fields.toArray(),
    getUnitDefaults(),
  ])
  if (!type) {
    throw new Error("Không tìm thấy loại hồ sơ")
  }
  const tMap = new Map(templates.map((t) => [t.id, t]))
  const dict = new Map(fields.map((f) => [f.code, f]))
  const defs = collectFields(type, tMap, dict, null)

  const data: DossierData = {}
  for (const def of defs) {
    if (def.type === "table") {
      data[def.code] = []
    } else if (def.group === UNIT_GROUP && unit[def.code]) {
      data[def.code] = unit[def.code] ?? ""
    } else if (def.defaultValue) {
      data[def.code] = def.defaultValue
    }
  }
  if (dict.has("ngay_lap")) {
    data.ngay_lap = todayIso()
  }
  if (dict.has("gio_lap")) {
    data.gio_lap = nowTime()
  }

  const now = Date.now()
  const id = newId()
  await db.dossiers.add({
    id,
    typeId,
    title: type.name,
    status: "draft",
    data,
    deadline: type.deadlineDays > 0 ? addDays(todayIso(), type.deadlineDays) : undefined,
    createdAt: now,
    updatedAt: now,
  })
  return id
}

export const duplicateDossier = async (id: string): Promise<string> => {
  const src = await db.dossiers.get(id)
  if (!src) {
    throw new Error("Không tìm thấy hồ sơ")
  }
  const now = Date.now()
  const copy: Dossier = {
    ...src,
    id: newId(),
    title: `${src.title} (bản sao)`,
    status: "draft",
    data: structuredClone(src.data),
    createdAt: now,
    updatedAt: now,
  }
  await db.dossiers.add(copy)
  return copy.id
}

/** Gợi ý tiêu đề: "<Loại hồ sơ> – <Họ tên>" */
export const suggestTitle = (typeName: string, data: DossierData): string => {
  const who = [data.ho_ten, data.nguoi_lien_quan_ho_ten].find((v) => typeof v === "string" && v.trim())
  const base = typeName.replace(/\s*\(minh họa\)\s*$/, "")
  return who ? `${base} – ${String(who).trim()}` : base
}

export interface GeneratedFile {
  fileName: string
  blob: Blob
  templateName: string
  /** Điều chỉnh thể thức NĐ 30/2020 đã áp dụng. */
  changes: string[]
}

export const generateComponent = async (
  component: ResolvedComponent,
  dictionary: Map<string, FieldDef>,
  data: DossierData,
  normalize = true
): Promise<GeneratedFile> => {
  if (!component.template) {
    throw new Error("Thành phần chưa gắn biểu mẫu")
  }
  const { blob, changes } = await renderTemplate(component.template.file, buildRenderData(dictionary, data), {
    guarded: component.template.guarded,
    normalize,
  })
  return {
    fileName: safeFileName(
      `${String(component.index + 1).padStart(2, "0")}. ${component.template.name}.docx`
    ),
    blob,
    templateName: component.template.name,
    changes,
  }
}

export const generateBundle = async (
  components: ResolvedComponent[],
  dictionary: Map<string, FieldDef>,
  data: DossierData,
  normalize = true
): Promise<Blob> => {
  const files = await Promise.all(
    components
      .filter((c) => c.included && c.template)
      .map((c) => generateComponent(c, dictionary, data, normalize))
  )
  const zip = new JSZip()
  for (const f of files) {
    zip.file(f.fileName, f.blob)
  }
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" })
}

export const daysUntil = (iso: string): number => {
  const target = new Date(`${iso}T00:00:00`).getTime()
  const today = new Date(`${todayIso()}T00:00:00`).getTime()
  return Math.round((target - today) / 86_400_000)
}

export type DeadlineTone = "overdue" | "soon" | "normal" | "none"

export const deadlineInfo = (
  dossier: Pick<Dossier, "deadline" | "status">
): { text: string; tone: DeadlineTone } => {
  if (!dossier.deadline || dossier.status === "done") {
    return { text: "", tone: "none" }
  }
  const left = daysUntil(dossier.deadline)
  if (left < 0) {
    return { text: `Quá hạn ${-left} ngày`, tone: "overdue" }
  }
  if (left === 0) {
    return { text: "Đến hạn hôm nay", tone: "soon" }
  }
  return { text: `Còn ${left} ngày`, tone: left <= 2 ? "soon" : "normal" }
}

export const TONE_CLASS: Record<DeadlineTone, string> = {
  overdue: "text-destructive",
  soon: "text-warning",
  normal: "text-muted-foreground",
  none: "text-muted-foreground",
}
