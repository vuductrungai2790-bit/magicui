/**
 * Tạo các biểu mẫu Word MINH HỌA và nhúng vào src/lib/sample-files.ts (dạng base64)
 * để phần mềm nạp được cả khi mở trực tiếp file index.html, không cần máy chủ.
 * Đây không phải biểu mẫu chính thức – người dùng thay bằng mẫu đang áp dụng.
 *
 * Chạy: pnpm gen:mau
 */
import { writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx"

const OUT_FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "sample-files.ts")
const FONT = "Times New Roman"
const SIZE = 26 // 13pt
const BOLD_SPLIT = /(\*\*[^*]+\*\*|__[^_]+__)/g

/** "**đậm**", "__nghiêng__" */
const runs = (text, base = {}) =>
  text
    .split(BOLD_SPLIT)
    .filter(Boolean)
    .map((chunk) => {
      if (chunk.startsWith("**")) {
        return new TextRun({ text: chunk.slice(2, -2), bold: true, font: FONT, size: SIZE, ...base })
      }
      if (chunk.startsWith("__")) {
        return new TextRun({ text: chunk.slice(2, -2), italics: true, font: FONT, size: SIZE, ...base })
      }
      return new TextRun({ text: chunk, font: FONT, size: SIZE, ...base })
    })

const p = (text, opts = {}) =>
  new Paragraph({
    children: runs(text, opts.run),
    alignment: opts.align ?? AlignmentType.JUSTIFIED,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 60, line: 300 },
    indent: opts.indent === false ? undefined : { firstLine: opts.firstLine ?? 567 },
  })

const center = (text, opts = {}) => p(text, { ...opts, align: AlignmentType.CENTER, indent: false })

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
const NO_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  insideHorizontal: NO_BORDER,
  insideVertical: NO_BORDER,
}

const cell = (paragraphs, width) =>
  new TableCell({
    children: paragraphs,
    width: { size: width, type: WidthType.PERCENTAGE },
    borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER },
  })

const header = (showNumber = true) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    rows: [
      new TableRow({
        children: [
          cell(
            [
              center("{ten_co_quan_cap_tren_hoa}", { after: 0 }),
              center("**{ten_don_vi_hoa}**", { after: 120 }),
              ...(showNumber ? [center("Số: {so_van_ban}", { after: 0 })] : []),
            ],
            40
          ),
          cell(
            [
              center("**CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM**", { after: 0 }),
              center("**Độc lập - Tự do - Hạnh phúc**", { after: 120 }),
              center("__{dia_danh}, {ngay_lap_chu}__", { after: 0 }),
            ],
            60
          ),
        ],
      }),
    ],
  })

const title = (main, sub) => [
  center(`**${main}**`, { before: 360, after: sub ? 0 : 240, run: { size: 28 } }),
  ...(sub ? [center(`**${sub}**`, { after: 240 })] : []),
]

const signatures = (cols) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    rows: [
      new TableRow({
        children: cols.map(([role, name]) =>
          cell(
            [
              center(`**${role}**`, { before: 240, after: 0 }),
              center("__(Ký, ghi rõ họ tên)__", { after: 1200 }),
              center(`**${name}**`, { after: 0 }),
            ],
            Math.floor(100 / cols.length)
          )
        ),
      }),
    ],
  })

const person = (prefix = "") => [
  p(`Họ và tên: **{${prefix}ho_ten_hoa}**; Giới tính: {${prefix}gioi_tinh}`),
  p(`Ngày, tháng, năm sinh: {${prefix}ngay_sinh}; Quốc tịch: {${prefix}quoc_tich}`),
  p(`Nghề nghiệp: {${prefix}nghe_nghiep}`),
  p(`Nơi ở hiện tại: {${prefix}noi_o_hien_tai}`),
  p(
    `Số định danh cá nhân/CCCD: {${prefix}so_dinh_danh}; ngày cấp: {${prefix}ngay_cap}; nơi cấp: {${prefix}noi_cap}`
  ),
]

const officer = () => [
  p(
    "Họ và tên: {can_bo_ho_ten}; Cấp bậc: {can_bo_cap_bac}; Chức vụ: {can_bo_chuc_vu}; Đơn vị: {ten_don_vi}."
  ),
]

const doc = (children) =>
  new Document({
    styles: { default: { document: { run: { font: FONT, size: SIZE } } } },
    sections: [
      {
        properties: {
          page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 1134 } },
        },
        children,
      },
    ],
  })

const TEMPLATES = {
  "bien-ban-vi-pham-hanh-chinh.docx": doc([
    header(),
    ...title("BIÊN BẢN VI PHẠM HÀNH CHÍNH"),
    p("Hôm nay, hồi {gio_lap_chu}, {ngay_lap_chu}, tại {dia_diem_lap}."),
    p("Căn cứ Luật Xử lý vi phạm hành chính và các văn bản quy định chi tiết thi hành."),
    p("**Chúng tôi gồm:**"),
    ...officer(),
    p("**Với sự chứng kiến của:**"),
    p(
      "Ông/bà: {nguoi_chung_kien_ho_ten}; Số định danh: {nguoi_chung_kien_so_dinh_danh}; Nơi cư trú: {nguoi_chung_kien_dia_chi}."
    ),
    p("**Tiến hành lập biên bản vi phạm hành chính đối với:**"),
    ...person(),
    p("**Đã có hành vi vi phạm hành chính:** {hanh_vi_vi_pham}"),
    p("Thời gian xảy ra vi phạm: {gio_vi_pham_chu}, {ngay_vi_pham_chu}, tại: {dia_diem_vi_pham}."),
    p("Quy định tại: {can_cu_phap_ly}"),
    p(
      "{#co_tang_vat}Tang vật, phương tiện vi phạm hành chính bị tạm giữ theo biên bản tạm giữ lập cùng ngày.{/co_tang_vat}{^co_tang_vat}Không tạm giữ tang vật, phương tiện vi phạm hành chính.{/co_tang_vat}"
    ),
    p("Ý kiến trình bày của cá nhân vi phạm: {y_kien_nguoi_vi_pham}"),
    p("Yêu cầu ông/bà **{ho_ten}** có mặt tại {ten_don_vi} vào {ngay_lap_chu} để giải quyết vụ việc."),
    p(
      "Biên bản lập xong hồi … giờ … phút cùng ngày, gồm … tờ, được lập thành … bản có nội dung và giá trị như nhau; đã đọc lại cho những người có tên trên cùng nghe, công nhận là đúng và cùng ký tên dưới đây."
    ),
    signatures([
      ["NGƯỜI VI PHẠM", "{ho_ten}"],
      ["NGƯỜI CHỨNG KIẾN", "{nguoi_chung_kien_ho_ten}"],
      ["NGƯỜI LẬP BIÊN BẢN", "{can_bo_ho_ten}"],
    ]),
  ]),

  "bien-ban-tam-giu-tang-vat.docx": doc([
    header(),
    ...title("BIÊN BẢN TẠM GIỮ", "tang vật, phương tiện vi phạm hành chính"),
    p("Hôm nay, hồi {gio_lap_chu}, {ngay_lap_chu}, tại {dia_diem_lap}."),
    p("**Chúng tôi gồm:**"),
    ...officer(),
    p("**Tiến hành tạm giữ tang vật, phương tiện vi phạm hành chính của:**"),
    ...person(),
    p(
      "Lý do tạm giữ: để xác minh tình tiết làm căn cứ ra quyết định xử phạt đối với hành vi: {hanh_vi_vi_pham}"
    ),
    p("**Tang vật, phương tiện bị tạm giữ gồm:**"),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: ["STT", "Tên, chủng loại", "Số lượng", "Đơn vị tính", "Tình trạng, đặc điểm"].map(
            (h, i) => cell([center(`**${h}**`, { after: 0 })], [8, 32, 14, 14, 32][i])
          ),
        }),
        new TableRow({
          children: [
            cell([center("{#tang_vat}{stt}", { after: 0 })], 8),
            cell([p("{ten}", { indent: false, after: 0, align: AlignmentType.LEFT })], 32),
            cell([center("{so_luong}", { after: 0 })], 14),
            cell([center("{don_vi_tinh}", { after: 0 })], 14),
            cell([p("{tinh_trang}{/tang_vat}", { indent: false, after: 0, align: AlignmentType.LEFT })], 32),
          ],
        }),
      ].map((row) => row),
    }),
    p("Tang vật, phương tiện được bảo quản tại: {noi_tam_giu}. Thời hạn tạm giữ: {thoi_han_tam_giu}.", {
      before: 120,
    }),
    p(
      "Biên bản được lập thành … bản, giao cho người có tang vật, phương tiện bị tạm giữ 01 bản; đã đọc lại cho những người có tên trên cùng nghe, công nhận là đúng và cùng ký tên dưới đây."
    ),
    signatures([
      ["NGƯỜI CÓ TANG VẬT", "{ho_ten}"],
      ["NGƯỜI CHỨNG KIẾN", "{nguoi_chung_kien_ho_ten}"],
      ["NGƯỜI LẬP BIÊN BẢN", "{can_bo_ho_ten}"],
    ]),
  ]),

  "quyet-dinh-xu-phat.docx": doc([
    header(),
    ...title("QUYẾT ĐỊNH", "Xử phạt vi phạm hành chính"),
    p("Căn cứ Luật Xử lý vi phạm hành chính và các văn bản quy định chi tiết thi hành;"),
    p("Căn cứ {can_cu_phap_ly};"),
    p("Căn cứ Biên bản vi phạm hành chính số {so_van_ban} lập ngày {ngay_lap};"),
    p(
      "Tôi: **{chi_huy_ho_ten}**; Cấp bậc: {chi_huy_cap_bac}; Chức vụ: {chi_huy_chuc_vu}; Đơn vị: {ten_don_vi}."
    ),
    center("**QUYẾT ĐỊNH:**", { before: 120 }),
    p("**Điều 1.** Xử phạt vi phạm hành chính đối với:"),
    ...person(),
    p("1. Đã thực hiện hành vi vi phạm hành chính: {hanh_vi_vi_pham}"),
    p("2. Quy định tại: {can_cu_phap_ly}"),
    p(
      "3. Hình thức xử phạt chính: {hinh_thuc_xu_phat}. Mức phạt: **{muc_phat} đồng** (Bằng chữ: {muc_phat_chu})."
    ),
    p("4. Biện pháp khắc phục hậu quả: {bien_phap_khac_phuc}"),
    p("**Điều 2.** Quyết định này có hiệu lực kể từ ngày ký."),
    p(
      "Ông/bà **{ho_ten}** phải nghiêm chỉnh chấp hành quyết định xử phạt trong thời hạn {thoi_han_thi_hanh} kể từ ngày nhận được quyết định; nộp tiền phạt tại {noi_nop_phat}. Quá thời hạn trên mà không chấp hành thì bị cưỡng chế thi hành theo quy định của pháp luật."
    ),
    p("**Điều 3.** Quyết định này được giao cho ông/bà {ho_ten} để chấp hành."),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: NO_BORDERS,
      rows: [
        new TableRow({
          children: [
            cell(
              [
                p("**__Nơi nhận:__**", { indent: false, after: 0 }),
                p("- Như Điều 3;", { indent: false, after: 0, run: { size: 22 } }),
                p("- Lưu: hồ sơ.", { indent: false, after: 0, run: { size: 22 } }),
              ],
              45
            ),
            cell(
              [
                center("**{chi_huy_chuc_vu_hoa}**", { before: 120, after: 0 }),
                center("__(Ký, ghi rõ họ tên, đóng dấu)__", { after: 1200 }),
                center("**{chi_huy_ho_ten}**", { after: 0 }),
              ],
              55
            ),
          ],
        }),
      ],
    }),
  ]),

  "bien-ban-tiep-nhan-tin-bao.docx": doc([
    header(),
    ...title("BIÊN BẢN TIẾP NHẬN", "tin báo, tố giác về vụ việc"),
    p("Hồi {gio_tiep_nhan_chu}, {ngay_tiep_nhan_chu}, tại {dia_diem_lap}."),
    p("**Người tiếp nhận:**"),
    ...officer(),
    p("**Người cung cấp thông tin:**"),
    p("Họ và tên: **{nguoi_lien_quan_ho_ten}**; Ngày sinh: {nguoi_lien_quan_ngay_sinh}"),
    p(
      "Số định danh cá nhân/CCCD: {nguoi_lien_quan_so_dinh_danh}; Số điện thoại: {nguoi_lien_quan_so_dien_thoai}"
    ),
    p("Nơi cư trú: {nguoi_lien_quan_noi_cu_tru}"),
    p("Hình thức tiếp nhận: {nguon_tin}."),
    p("**Nội dung tin báo:**"),
    p("{noi_dung_tin_bao}"),
    p(
      "Biên bản lập xong hồi … giờ … phút cùng ngày, đã đọc lại cho người cung cấp thông tin nghe, công nhận là đúng và cùng ký tên dưới đây."
    ),
    signatures([
      ["NGƯỜI CUNG CẤP THÔNG TIN", "{nguoi_lien_quan_ho_ten}"],
      ["NGƯỜI TIẾP NHẬN", "{can_bo_ho_ten}"],
    ]),
  ]),

  "bien-ban-ghi-loi-khai.docx": doc([
    header(false),
    ...title("BIÊN BẢN GHI LỜI KHAI"),
    p("Hồi {gio_lap_chu}, {ngay_lap_chu}, tại {dia_diem_lap}."),
    p(
      "**Tôi:** {can_bo_ho_ten}; Cấp bậc: {can_bo_cap_bac}; Chức vụ: {can_bo_chuc_vu}; Đơn vị: {ten_don_vi}."
    ),
    p("**Tiến hành ghi lời khai của:**"),
    ...person(),
    p("Số điện thoại: {so_dien_thoai}"),
    p("**Nội dung lời khai:**"),
    p("{loi_khai}"),
    p(
      "Biên bản ghi lời khai kết thúc hồi … giờ … phút cùng ngày, đã đọc lại cho người khai nghe, công nhận là đúng và cùng ký tên dưới đây."
    ),
    signatures([
      ["NGƯỜI KHAI", "{ho_ten}"],
      ["NGƯỜI GHI LỜI KHAI", "{can_bo_ho_ten}"],
    ]),
  ]),

  "bien-ban-hoa-giai.docx": doc([
    header(false),
    ...title("BIÊN BẢN", "hòa giải mâu thuẫn"),
    p("Hồi {gio_lap_chu}, {ngay_lap_chu}, tại {dia_diem_lap}."),
    p("**Thành phần chủ trì:**"),
    ...officer(),
    p(
      "**Bên thứ nhất:** ông/bà **{ho_ten}**, sinh ngày {ngay_sinh}, Số định danh: {so_dinh_danh}, nơi ở: {noi_o_hien_tai}."
    ),
    p(
      "**Bên thứ hai:** ông/bà **{nguoi_lien_quan_ho_ten}**, sinh ngày {nguoi_lien_quan_ngay_sinh}, Số định danh: {nguoi_lien_quan_so_dinh_danh}, nơi cư trú: {nguoi_lien_quan_noi_cu_tru}."
    ),
    p("**Nội dung sự việc:**"),
    p("{dien_bien}"),
    p("**Kết quả hòa giải:**"),
    p("{ket_qua_hoa_giai}"),
    p("Biên bản đã được đọc lại cho các bên cùng nghe, công nhận là đúng và cùng ký tên dưới đây."),
    signatures([
      ["BÊN THỨ NHẤT", "{ho_ten}"],
      ["BÊN THỨ HAI", "{nguoi_lien_quan_ho_ten}"],
      ["CÁN BỘ CHỦ TRÌ", "{can_bo_ho_ten}"],
    ]),
  ]),
}

const entries = []
for (const [name, document] of Object.entries(TEMPLATES)) {
  const buffer = await Packer.toBuffer(document)
  entries.push(`  "${name}":\n    "${buffer.toString("base64")}",`)
  process.stdout.write(`✓ ${name}\n`)
}

await writeFile(
  OUT_FILE,
  `// Tệp sinh tự động bởi scripts/tao-mau.mjs – không sửa tay.
// Các biểu mẫu Word minh họa, mã hóa base64.
export const SAMPLE_FILES: Record<string, string> = {
${entries.join("\n")}
}
`
)
process.stdout.write(`→ ${OUT_FILE}\n`)
