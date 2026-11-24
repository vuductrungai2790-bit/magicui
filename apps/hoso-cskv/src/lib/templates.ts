import { analyzeBlanks, type Blank, type BlankAnalysis, type BlankSuffix, convertBlanks } from "./blanks"
import { db, newId } from "./db"
import { inspectTemplate } from "./docx"
import { resolveTemplateFields } from "./fields"
import type { FieldDef, FieldType, TemplateRecord } from "./types"

const DOCX_EXT = /\.docx$/i

export const isDocx = (file: File): boolean => DOCX_EXT.test(file.name)

export const nameFromFile = (fileName: string): string => {
  const raw = fileName.replace(DOCX_EXT, "").replace(/_+/g, " ")
  // "bien-ban-vi-pham" → "bien ban vi pham"; giữ nguyên dấu gạch trong "01 - Quyết định - Mẫu CĐ1".
  const base = (raw.includes(" ") ? raw : raw.replace(/-+/g, " ")).replace(/\s+/g, " ").trim()
  return base ? `${base.charAt(0).toUpperCase()}${base.slice(1)}` : "Biểu mẫu"
}

const getDictionary = async (): Promise<Map<string, FieldDef>> => {
  const all = await db.fields.toArray()
  return new Map(all.map((f) => [f.code, f]))
}

interface AnalyzeResult {
  tags: TemplateRecord["tags"]
  fieldCodes: string[]
  newFields: FieldDef[]
}

/** Đọc thẻ trong file, quy về trường gốc, thêm trường mới vào từ điển. */
const analyze = async (blob: Blob): Promise<AnalyzeResult> => {
  const tags = inspectTemplate(await blob.arrayBuffer())
  const dictionary = await getDictionary()
  const { codes, newFields } = resolveTemplateFields(tags, dictionary)
  if (newFields.length > 0) {
    await db.fields.bulkPut(newFields)
  }
  return { tags, fieldCodes: codes, newFields }
}

export interface SaveTemplateResult {
  template: TemplateRecord
  newFields: FieldDef[]
}

export const addTemplate = async (
  file: Blob,
  fileName: string,
  name: string,
  description = ""
): Promise<SaveTemplateResult> => {
  const { tags, fieldCodes, newFields } = await analyze(file)
  const now = Date.now()
  const template: TemplateRecord = {
    id: newId(),
    name: name.trim() || nameFromFile(fileName),
    description,
    fileName,
    file,
    tags,
    fieldCodes,
    version: 1,
    createdAt: now,
    updatedAt: now,
  }
  await db.templates.add(template)
  return { template, newFields }
}

export const replaceTemplateFile = async (
  id: string,
  file: Blob,
  fileName: string
): Promise<SaveTemplateResult> => {
  const current = await db.templates.get(id)
  if (!current) {
    throw new Error("Không tìm thấy biểu mẫu")
  }
  const { tags, fieldCodes, newFields } = await analyze(file)
  const template: TemplateRecord = {
    ...current,
    file,
    fileName,
    tags,
    fieldCodes,
    version: current.version + 1,
    updatedAt: Date.now(),
    guarded: undefined,
    examples: undefined,
    originalFile: undefined,
  }
  await db.templates.put(template)
  return { template, newFields }
}

/** Phân tích lại toàn bộ mẫu (sau khi sửa từ điển trường). */
export const reanalyzeAll = async (): Promise<void> => {
  const all = await db.templates.toArray()
  await Promise.all(
    all.map(async (t) => {
      const { tags, fieldCodes } = await analyze(t.file)
      await db.templates.update(t.id, { tags, fieldCodes })
    })
  )
}

export const deleteTemplate = async (id: string): Promise<void> => {
  await db.transaction("rw", db.templates, db.dossierTypes, async () => {
    await db.templates.delete(id)
    const types = await db.dossierTypes.toArray()
    await Promise.all(
      types
        .filter((t) => t.components.some((c) => c.templateId === id))
        .map((t) =>
          db.dossierTypes.update(t.id, {
            components: t.components.filter((c) => c.templateId !== id),
          })
        )
    )
  })
}

/* ------------------------------------------------------------------ */
/* Biểu mẫu chưa đánh dấu: tự nhận diện chỗ "……" rồi người dùng rà soát */
/* ------------------------------------------------------------------ */

export interface PreparedTemplate {
  buffer: ArrayBuffer
  analysis: BlankAnalysis
}

export const prepareTemplate = async (file: Blob): Promise<PreparedTemplate> => {
  const buffer = await file.arrayBuffer()
  return { buffer, analysis: analyzeBlanks(buffer) }
}

export interface FieldMeta {
  label: string
  type: FieldType
  group: string
}

const NUMBERED = /^(.*)_(\d+)$/

/** Tạo định nghĩa trường cho các mã chưa có trong từ điển. */
const ensureFields = async (blanks: Blank[], meta: Record<string, FieldMeta>): Promise<void> => {
  const dictionary = await getDictionary()
  const created = new Map<string, FieldDef>()
  let order = 20_000 + (Date.now() % 10_000)
  for (const b of blanks) {
    if (dictionary.has(b.code) || created.has(b.code)) {
      continue
    }
    const m = meta[b.code]
    const numbered = NUMBERED.exec(b.code)
    const base = numbered ? dictionary.get(numbered[1] ?? "") : undefined
    order += 1
    created.set(b.code, {
      code: b.code,
      label: m?.label ?? (base ? `${base.label} (${numbered?.[2]})` : b.label),
      type: m?.type ?? base?.type ?? b.type,
      group: m?.group ?? base?.group ?? b.group,
      required: false,
      options: base?.options,
      order: base ? base.order + 0.5 : order,
    })
  }
  if (created.size > 0) {
    await db.fields.bulkPut([...created.values()])
  }
}

const collectSamples = (blanks: Blank[]): Record<string, string> => {
  const examples: Record<string, string> = {}
  const dateParts = new Map<string, Partial<Record<BlankSuffix, string>>>()
  for (const b of blanks) {
    if (!b.sample) {
      continue
    }
    if (b.suffix === "" || b.suffix === "_hoa") {
      examples[b.code] ??= b.sample
    } else if (b.suffix === "_ngay" || b.suffix === "_thang" || b.suffix === "_nam") {
      const key = `${b.para}:${b.code}`
      dateParts.set(key, { ...(dateParts.get(key) ?? {}), [b.suffix]: b.sample })
    }
  }
  for (const [key, parts] of dateParts) {
    const code = key.split(":")[1] ?? ""
    if (parts._ngay && parts._thang && parts._nam) {
      examples[code] ??= `${parts._ngay.padStart(2, "0")}/${parts._thang.padStart(2, "0")}/${parts._nam}`
    }
  }
  return examples
}

export interface SaveDetectedInput {
  original: Blob
  fileName: string
  name: string
  description: string
  blanks: Blank[]
  meta: Record<string, FieldMeta>
  /** Có giá trị: thay file cho biểu mẫu đã có. */
  targetId?: string
}

export const saveDetectedTemplate = async (input: SaveDetectedInput): Promise<SaveTemplateResult> => {
  await ensureFields(input.blanks, input.meta)
  const { buffer, guarded } = convertBlanks(await input.original.arrayBuffer(), input.blanks)
  const converted = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  })
  const result = input.targetId
    ? await replaceTemplateFile(input.targetId, converted, input.fileName)
    : await addTemplate(converted, input.fileName, input.name, input.description)
  const extra = { originalFile: input.original, guarded, examples: collectSamples(input.blanks) }
  await db.templates.update(result.template.id, extra)
  return { ...result, template: { ...result.template, ...extra } }
}
