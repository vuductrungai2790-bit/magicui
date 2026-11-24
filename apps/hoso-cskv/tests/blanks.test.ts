import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { AlignmentType, Document, Packer, Paragraph, Tab, TabStopType, TextRun } from "docx"
import PizZip from "pizzip"

import { analyzeBlanks, convertBlanks } from "../src/lib/blanks"
import { buildRenderData, inspectTemplate, renderTemplate } from "../src/lib/docx"
import { BUILTIN_FIELDS, resolveTemplateFields } from "../src/lib/fields"

const dict = new Map(BUILTIN_FIELDS.map((f) => [f.code, f]))
const leader = { tabStops: [{ type: TabStopType.LEFT, position: 9000, leader: "dot" as const }] }

/** Biểu mẫu giả lập 3 dạng chỗ trống thường gặp. */
const makeDoc = async (): Promise<ArrayBuffer> => {
  const doc = new Document({
    styles: { default: { document: { run: { font: ".VnTime" } } } },
    sections: [
      {
        properties: { page: { margin: { top: 500, bottom: 500, left: 800, right: 3000 } } },
        children: [
          new Paragraph({ children: [new TextRun("CÔNG AN TỈNH A")] }),
          new Paragraph({ children: [new TextRun("CÔNG AN XÃ B")] }),
          new Paragraph({ children: [new TextRun("Số: ........../BB")] }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun("Xã B, ngày …… tháng …… năm ……")],
          }),
          new Paragraph({ children: [new TextRun("BIÊN BẢN")] }),
          new Paragraph({ children: [new TextRun("Chúng tôi gồm:")] }),
          new Paragraph({ children: [new TextRun("Họ và tên: Nguyễn Văn Cán      Cấp bậc: Đại úy")] }),
          new Paragraph({ children: [new TextRun("Làm việc với người bị cấm đi khỏi nơi cư trú:")] }),
          new Paragraph({ children: [new TextRun("Họ và tên: TRẦN VĂN MẪU   Ngày sinh: 01/02/1990")] }),
          new Paragraph({
            ...leader,
            children: [new TextRun("Nghề nghiệp: "), new TextRun({ children: [new Tab()] })],
          }),
          new Paragraph({
            children: [new TextRun("Sinh ngày ...... tháng ...... năm ...... tại: ..........")],
          }),
          new Paragraph({ children: [new TextRun("Tôi xin cam kết như sau:")] }),
          new Paragraph({ ...leader, children: [new TextRun({ children: [new Tab()] })] }),
          new Paragraph({ ...leader, children: [new TextRun({ children: [new Tab()] })] }),
          new Paragraph({ ...leader, children: [new TextRun({ children: [new Tab()] })] }),
        ],
      },
    ],
  })
  const buf = await Packer.toBuffer(doc)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

const textOf = (blob: ArrayBuffer): string => {
  const xml = new PizZip(blob).file("word/document.xml")?.asText() ?? ""
  return [...xml.matchAll(/<w:p[ >].*?<\/w:p>/gs)]
    .map((m) => [...m[0].matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((x) => x[1]).join(""))
    .join("\n")
}

describe("tự nhận diện chỗ cần điền", () => {
  it("nhận đủ các dạng chỗ trống và gán đúng người", async () => {
    const a = analyzeBlanks(await makeDoc())
    const by = (code: string) => a.blanks.filter((b) => b.code === code)
    assert.equal(by("ten_co_quan_cap_tren")[0]?.suffix, "_hoa")
    assert.equal(by("ten_don_vi")[0]?.sample, "CÔNG AN XÃ B")
    assert.equal(by("so_van_ban")[0]?.mode, "guard")
    assert.equal(by("dia_danh")[0]?.sample, "Xã B")
    assert.equal(by("ngay_lap").length, 3)
    assert.equal(by("can_bo_ho_ten")[0]?.sample, "Nguyễn Văn Cán")
    assert.equal(by("can_bo_cap_bac")[0]?.sample, "Đại úy")
    assert.equal(by("ho_ten")[0]?.suffix, "_hoa")
    assert.equal(by("ngay_sinh")[0]?.type, "date")
    assert.equal(by("nghe_nghiep")[0]?.mode, "guard")
    assert.equal(by("noi_sinh")[0]?.mode, "guard")
    const camKet = by("noi_dung_cam_ket")[0]
    assert.equal(camKet?.type, "textarea")
    assert.equal(camKet?.lines?.length, 2)
  })

  it("chuyển thành thẻ, ghép dữ liệu, để trống thì giữ dòng chấm", async () => {
    const src = await makeDoc()
    const a = analyzeBlanks(src)
    const { buffer, guarded } = convertBlanks(
      src,
      a.blanks.filter((b) => b.confidence === "high")
    )
    const tags = inspectTemplate(buffer)
    const { codes } = resolveTemplateFields(tags, dict)
    assert.ok(codes.includes("ho_ten"))
    assert.ok(codes.includes("ngay_sinh"))
    assert.ok(!codes.some((c) => c.endsWith("_ngay")))

    const filled = await renderTemplate(
      new Blob([buffer]),
      buildRenderData(dict, {
        ho_ten: "Lê Thị Hoa",
        ngay_lap: "2026-03-05",
        so_van_ban: "7",
        nghe_nghiep: "Tự do",
      }),
      { guarded, normalize: true }
    )
    const t1 = textOf(await filled.blob.arrayBuffer())
    assert.ok(t1.includes("Họ và tên: LÊ THỊ HOA"))
    assert.ok(t1.includes("ngày 05 tháng 3 năm 2026"))
    assert.ok(t1.includes("Số: 07/BB"))
    assert.ok(t1.includes("Nghề nghiệp: Tự do"))
    assert.ok(filled.changes.some((c) => c.includes("Times New Roman")))
    assert.ok(filled.changes.some((c) => c.startsWith("Lề trái")))

    const empty = await renderTemplate(new Blob([buffer]), buildRenderData(dict, {}), { guarded })
    const t2 = textOf(await empty.blob.arrayBuffer())
    assert.ok(t2.includes("Số: ........../BB"))
    assert.ok(t2.includes("Sinh ngày ...... tháng ...... năm ......"))
    assert.ok(!t2.includes("{"))
  })
})
