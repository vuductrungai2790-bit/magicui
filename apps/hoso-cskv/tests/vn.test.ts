import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { buildRenderData, inspectTemplate, renderTemplate } from "../src/lib/docx"
import { BUILTIN_FIELDS, resolveTemplateFields } from "../src/lib/fields"
import { SAMPLE_FILES } from "../src/lib/sample-files"
import { dateToWords, moneyToWords, numberToWords, timeToWords } from "../src/lib/vn"

const dict = new Map(BUILTIN_FIELDS.map((f) => [f.code, f]))
const mau = (name: string): ArrayBuffer => {
  const buf = Buffer.from(SAMPLE_FILES[name] ?? "", "base64")
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

describe("đọc số thành chữ", () => {
  it("đọc đúng các trường hợp đặc biệt", () => {
    const cases: [number, string][] = [
      [0, "không"],
      [15, "mười lăm"],
      [21, "hai mươi mốt"],
      [24, "hai mươi tư"],
      [105, "một trăm linh năm"],
      [1005, "một nghìn không trăm linh năm"],
      [750_000, "bảy trăm năm mươi nghìn"],
      [1_500_000, "một triệu năm trăm nghìn"],
      [2_000_000_000, "hai tỷ"],
    ]
    for (const [n, text] of cases) {
      assert.equal(numberToWords(n), text)
    }
  })

  it("số tiền viết hoa chữ đầu, kèm đồng", () => {
    assert.equal(moneyToWords(1_500_000), "Một triệu năm trăm nghìn đồng")
  })
})

describe("ngày giờ", () => {
  it("thêm số 0 cho ngày < 10 và tháng 1, 2", () => {
    assert.equal(dateToWords("2026-03-05"), "ngày 05 tháng 3 năm 2026")
    assert.equal(dateToWords("2026-02-15"), "ngày 15 tháng 02 năm 2026")
  })
  it("giờ phút", () => {
    assert.equal(timeToWords("9:05"), "09 giờ 05 phút")
  })
})

describe("biểu mẫu", () => {
  it("quy thẻ có hậu tố về trường gốc và nhận diện bảng lặp", () => {
    const tags = inspectTemplate(mau("bien-ban-tam-giu-tang-vat.docx"))
    const { codes, newFields } = resolveTemplateFields(tags, dict)
    assert.ok(codes.includes("ho_ten"))
    assert.ok(codes.includes("ngay_lap"))
    assert.ok(!codes.includes("ngay_lap_chu"))
    assert.ok(codes.includes("tang_vat"))
    assert.equal(newFields.length, 0)
  })

  it("tự thêm trường mới với kiểu đoán từ mã", () => {
    const { newFields } = resolveTemplateFields(
      {
        simple: ["ngay_tam_giu_chu", "so_tien_bao_lanh"],
        sections: [{ name: "co_nguoi_phien_dich", children: [] }],
      },
      dict
    )
    const byCode = new Map(newFields.map((f) => [f.code, f.type]))
    assert.equal(byCode.get("ngay_tam_giu"), "date")
    assert.equal(byCode.get("so_tien_bao_lanh"), "money")
    assert.equal(byCode.get("co_nguoi_phien_dich"), "boolean")
  })

  it("ghép dữ liệu, nhân dòng bảng và in chỗ trống", async () => {
    const data = buildRenderData(dict, {
      ho_ten: "Nguyễn Văn An",
      muc_phat: "1500000",
      tang_vat: [
        { _id: "1", ten: "Loa kéo", so_luong: "1" },
        { _id: "2", ten: "Micro", so_luong: "2" },
      ],
    })
    const { blob: out } = await renderTemplate(new Blob([mau("bien-ban-tam-giu-tang-vat.docx")]), data)
    const PizZip = (await import("pizzip")).default
    const xml = new PizZip(await out.arrayBuffer()).file("word/document.xml")?.asText() ?? ""
    assert.ok(xml.includes("NGUYỄN VĂN AN"))
    assert.ok(xml.includes("Loa kéo"))
    assert.ok(xml.includes("Micro"))
    assert.ok(xml.includes("……"))
    assert.ok(!xml.includes("{"))
  })
})
