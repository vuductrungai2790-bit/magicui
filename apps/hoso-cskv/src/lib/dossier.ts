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
  index: number
  template: TemplateRecord | undefined
  conditionField?: string
  included: boolean
}

export const resolveComponents = (
  type: DossierType,
  templates: Map<string, TemplateRecord>,
  data: DossierData
): ResolvedComponent[] =>
  type.components.map((c, index) => ({
    index,
    template: templates.get(c.templateId),
    conditionField: c.conditionField,
    included: isComponentIncluded(c, data),
  }))

/**
 * Danh sách trường cần nhập cho loại hồ sơ (gộp từ tất cả thành phần, mỗi trường một lần).
 * `onlyIncluded` = chỉ lấy trường của các thành phần đang được đưa vào bộ hồ sơ.
 */
export const collectFields = (
  type: DossierType,
  templates: Map<string, TemplateRecord>,
  dictionary: Map<string, FieldDef>,
  data: DossierData | null
): FieldDef[] => {
  const codes = new Set<string>()
  for (const c of type.components) {
    if (c.conditionField) {
      codes.add(c.conditionField)
    }
  }
  for (const c of type.components) {
    if (data && !isComponentIncluded(c, data)) {
      continue
    }
    for (const code of templates.get(c.templateId)?.fieldCodes ?? []) {
      codes.add(code)
    }
  }
  const defs = [...codes].map((code) => dictionary.get(code)).filter((d): d is FieldDef => Boolean(d))
  return sortFields(defs)
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
}

export const generateComponent = async (
  component: ResolvedComponent,
  dictionary: Map<string, FieldDef>,
  data: DossierData
): Promise<GeneratedFile> => {
  if (!component.template) {
    throw new Error("Thành phần chưa gắn biểu mẫu")
  }
  const blob = await renderTemplate(component.template.file, buildRenderData(dictionary, data))
  return {
    fileName: safeFileName(
      `${String(component.index + 1).padStart(2, "0")}. ${component.template.name}.docx`
    ),
    blob,
    templateName: component.template.name,
  }
}

export const generateBundle = async (
  components: ResolvedComponent[],
  dictionary: Map<string, FieldDef>,
  data: DossierData
): Promise<Blob> => {
  const files = await Promise.all(
    components.filter((c) => c.included && c.template).map((c) => generateComponent(c, dictionary, data))
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
