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
