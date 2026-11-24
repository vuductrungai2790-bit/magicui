import { base64ToBlob } from "./backup"
import { db, newId } from "./db"
import { addTemplate } from "./templates"
import type { DossierType } from "./types"

/** Bộ dữ liệu minh họa: 6 biểu mẫu và 2 loại hồ sơ. */
const SAMPLE_TEMPLATES = [
  { file: "bien-ban-vi-pham-hanh-chinh.docx", name: "Biên bản vi phạm hành chính" },
  { file: "bien-ban-tam-giu-tang-vat.docx", name: "Biên bản tạm giữ tang vật, phương tiện" },
  { file: "quyet-dinh-xu-phat.docx", name: "Quyết định xử phạt vi phạm hành chính" },
  { file: "bien-ban-tiep-nhan-tin-bao.docx", name: "Biên bản tiếp nhận tin báo" },
  { file: "bien-ban-ghi-loi-khai.docx", name: "Biên bản ghi lời khai" },
  { file: "bien-ban-hoa-giai.docx", name: "Biên bản hòa giải mâu thuẫn" },
] as const

const DESCRIPTION = "Mẫu minh họa – hãy thay bằng biểu mẫu chính thức đang áp dụng tại đơn vị."

export const loadSampleData = async (): Promise<void> => {
  const { SAMPLE_FILES } = await import("./sample-files")
  const saved = await Promise.all(
    SAMPLE_TEMPLATES.map(async (t) => {
      const b64 = SAMPLE_FILES[t.file]
      if (!b64) {
        throw new Error(`Thiếu biểu mẫu minh họa ${t.file}`)
      }
      const { template } = await addTemplate(base64ToBlob(b64), t.file, `${t.name} (minh họa)`, DESCRIPTION)
      return [t.file, template.id] as const
    })
  )
  const ids: Record<string, string> = Object.fromEntries(saved)

  const now = Date.now()
  const id = (file: (typeof SAMPLE_TEMPLATES)[number]["file"]): string => ids[file] ?? ""

  const types: DossierType[] = [
    {
      id: newId(),
      name: "Xử phạt vi phạm hành chính (minh họa)",
      description: "Biên bản vi phạm, tạm giữ tang vật (nếu có) và quyết định xử phạt.",
      category: "Xử lý vi phạm hành chính",
      components: [
        { templateId: id("bien-ban-vi-pham-hanh-chinh.docx") },
        { templateId: id("bien-ban-tam-giu-tang-vat.docx"), conditionField: "co_tang_vat" },
        { templateId: id("quyet-dinh-xu-phat.docx") },
      ],
      deadlineDays: 7,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      name: "Giải quyết tin báo, hòa giải mâu thuẫn (minh họa)",
      description: "Tiếp nhận tin báo, ghi lời khai và hòa giải giữa các bên.",
      category: "Tin báo, đơn thư, vụ việc",
      components: [
        { templateId: id("bien-ban-tiep-nhan-tin-bao.docx") },
        { templateId: id("bien-ban-ghi-loi-khai.docx") },
        { templateId: id("bien-ban-hoa-giai.docx") },
      ],
      deadlineDays: 20,
      createdAt: now,
      updatedAt: now,
    },
  ]
  await db.dossierTypes.bulkAdd(types)
}
