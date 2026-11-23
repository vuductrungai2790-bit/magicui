import { db } from "./db"
import type { Dossier, DossierType, FieldDef, SettingRecord, TemplateRecord } from "./types"

const FORMAT = "hoso-cskv-backup"

type SerializedTemplate = Omit<TemplateRecord, "file"> & { fileBase64: string }

interface BackupFile {
  format: typeof FORMAT
  version: 1
  exportedAt: number
  templates: SerializedTemplate[]
  fields: FieldDef[]
  dossierTypes: DossierType[]
  dossiers: Dossier[]
  settings: SettingRecord[]
}

const blobToBase64 = async (blob: Blob): Promise<string> => {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ""
  const chunk = 0x80_00
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

const base64ToBlob = (b64: string): Blob => {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  })
}

export const exportBackup = async (): Promise<Blob> => {
  const [templates, fields, dossierTypes, dossiers, settings] = await Promise.all([
    db.templates.toArray(),
    db.fields.toArray(),
    db.dossierTypes.toArray(),
    db.dossiers.toArray(),
    db.settings.toArray(),
  ])
  const serialized = await Promise.all(
    templates.map(async ({ file, ...rest }) => ({ ...rest, fileBase64: await blobToBase64(file) }))
  )
  const backup: BackupFile = {
    format: FORMAT,
    version: 1,
    exportedAt: Date.now(),
    templates: serialized,
    fields,
    dossierTypes,
    dossiers,
    settings,
  }
  return new Blob([JSON.stringify(backup)], { type: "application/json" })
}

/** Khôi phục: thay thế toàn bộ dữ liệu hiện có. */
export const importBackup = async (file: File): Promise<void> => {
  let parsed: BackupFile
  try {
    parsed = JSON.parse(await file.text()) as BackupFile
  } catch {
    throw new Error("File sao lưu không hợp lệ.")
  }
  if (parsed.format !== FORMAT) {
    throw new Error("Đây không phải file sao lưu của Hồ sơ CSKV.")
  }
  const templates: TemplateRecord[] = parsed.templates.map(({ fileBase64, ...rest }) => ({
    ...rest,
    file: base64ToBlob(fileBase64),
  }))
  await db.transaction(
    "rw",
    [db.templates, db.fields, db.dossierTypes, db.dossiers, db.settings],
    async () => {
      await Promise.all([
        db.templates.clear(),
        db.fields.clear(),
        db.dossierTypes.clear(),
        db.dossiers.clear(),
        db.settings.clear(),
      ])
      await Promise.all([
        db.templates.bulkAdd(templates),
        db.fields.bulkAdd(parsed.fields),
        db.dossierTypes.bulkAdd(parsed.dossierTypes),
        db.dossiers.bulkAdd(parsed.dossiers),
        db.settings.bulkAdd(parsed.settings),
      ])
    }
  )
}

export const wipeAll = async (): Promise<void> => {
  await db.delete()
  await db.open()
}
