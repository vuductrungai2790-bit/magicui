import Dexie, { type EntityTable } from "dexie"

import { BUILTIN_FIELDS } from "./fields"
import type { Dossier, DossierType, FieldDef, SettingRecord, TemplateRecord } from "./types"

/**
 * Toàn bộ dữ liệu được lưu trong IndexedDB của trình duyệt trên máy đang dùng.
 * Không có máy chủ, không gửi dữ liệu ra ngoài.
 */
class HoSoDatabase extends Dexie {
  templates!: EntityTable<TemplateRecord, "id">
  fields!: EntityTable<FieldDef, "code">
  dossierTypes!: EntityTable<DossierType, "id">
  dossiers!: EntityTable<Dossier, "id">
  settings!: EntityTable<SettingRecord, "key">

  constructor() {
    super("hoso-cskv")
    this.version(1).stores({
      templates: "id, name, updatedAt",
      fields: "code, group, order",
      dossierTypes: "id, name, category, updatedAt",
      dossiers: "id, typeId, status, updatedAt, deadline",
      settings: "key",
    })
    // Phiên bản 2: bổ sung các trường có sẵn mới (không ghi đè trường người dùng đã sửa).
    this.version(2)
      .stores({})
      .upgrade(async (tx) => {
        const table = tx.table<FieldDef, string>("fields")
        const existing = new Set(await table.toCollection().primaryKeys())
        await table.bulkAdd(BUILTIN_FIELDS.filter((f) => !existing.has(f.code)))
      })
    this.on("populate", (tx) => {
      tx.table("fields").bulkAdd(BUILTIN_FIELDS)
    })
  }
}

export const db = new HoSoDatabase()

export const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

export const UNIT_SETTINGS_KEY = "unit-defaults"

export const getUnitDefaults = async (): Promise<Record<string, string>> => {
  const rec = await db.settings.get(UNIT_SETTINGS_KEY)
  return (rec?.value as Record<string, string> | undefined) ?? {}
}

export const saveUnitDefaults = async (values: Record<string, string>): Promise<void> => {
  await db.settings.put({ key: UNIT_SETTINGS_KEY, value: values })
}

/** Đọc một cài đặt (có giá trị mặc định). */
export const getSetting = async <T extends object>(key: string, fallback: T): Promise<T> => {
  const rec = await db.settings.get(key)
  return { ...fallback, ...((rec?.value as Partial<T> | undefined) ?? {}) }
}

export const saveSetting = async <T extends object>(key: string, value: T): Promise<void> => {
  await db.settings.put({ key, value })
}

export interface FormatSettings {
  /** Tự chuẩn hóa thể thức NĐ 30/2020 khi xuất file. */
  normalize: boolean
}

export const FORMAT_KEY = "the-thuc"
export const DEFAULT_FORMAT: FormatSettings = { normalize: true }
