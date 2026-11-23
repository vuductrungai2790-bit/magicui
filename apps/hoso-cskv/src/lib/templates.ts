import { db, newId } from "./db"
import { inspectTemplate } from "./docx"
import { resolveTemplateFields } from "./fields"
import type { FieldDef, TemplateRecord } from "./types"

const DOCX_EXT = /\.docx$/i

export const isDocx = (file: File): boolean => DOCX_EXT.test(file.name)

export const nameFromFile = (fileName: string): string => {
  const base = fileName.replace(DOCX_EXT, "").replace(/[-_]+/g, " ").trim()
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
