import type { ColumnDef, FieldDef, FieldType, TemplateTags } from "./types"

export const GROUPS = [
  "Thông tin chung",
  "Đơn vị & cán bộ",
  "Vụ việc",
  "Người vi phạm / đối tượng",
  "Người bị hại / liên quan",
  "Người chứng kiến",
  "Tang vật, phương tiện",
  "Xử lý",
  "Khác",
] as const

export const DEFAULT_GROUP = "Khác"

/** Trường thuộc nhóm này lấy giá trị mặc định từ trang Cài đặt. */
export const UNIT_GROUP = "Đơn vị & cán bộ"

type Seed = Omit<FieldDef, "order" | "required"> & { required?: boolean }

const SEED: Seed[] = [
  // Thông tin chung
  {
    code: "so_van_ban",
    label: "Số văn bản",
    type: "text",
    group: "Thông tin chung",
    hint: "Ví dụ: 15/BB-VPHC",
  },
  { code: "ngay_lap", label: "Ngày lập", type: "date", group: "Thông tin chung", required: true },
  { code: "gio_lap", label: "Giờ lập", type: "time", group: "Thông tin chung" },
  { code: "dia_diem_lap", label: "Địa điểm lập", type: "text", group: "Thông tin chung" },
  { code: "gio_ket_thuc", label: "Giờ kết thúc", type: "time", group: "Thông tin chung" },
  { code: "kinh_gui", label: "Kính gửi", type: "text", group: "Thông tin chung" },

  // Đơn vị & cán bộ
  {
    code: "ten_co_quan_cap_tren",
    label: "Cơ quan cấp trên",
    type: "text",
    group: UNIT_GROUP,
    hint: "Ví dụ: CÔNG AN TỈNH …",
  },
  {
    code: "ten_don_vi",
    label: "Tên đơn vị",
    type: "text",
    group: UNIT_GROUP,
    hint: "Ví dụ: CÔNG AN PHƯỜNG …",
  },
  {
    code: "dia_danh",
    label: "Địa danh",
    type: "text",
    group: UNIT_GROUP,
    hint: "Dùng ở dòng “…, ngày … tháng … năm …”",
  },
  { code: "can_bo_ho_ten", label: "Cán bộ lập – họ tên", type: "text", group: UNIT_GROUP, required: true },
  { code: "can_bo_cap_bac", label: "Cán bộ lập – cấp bậc", type: "text", group: UNIT_GROUP },
  { code: "can_bo_chuc_vu", label: "Cán bộ lập – chức vụ", type: "text", group: UNIT_GROUP },
  { code: "chi_huy_ho_ten", label: "Người có thẩm quyền – họ tên", type: "text", group: UNIT_GROUP },
  { code: "chi_huy_cap_bac", label: "Người có thẩm quyền – cấp bậc", type: "text", group: UNIT_GROUP },
  { code: "chi_huy_chuc_vu", label: "Người có thẩm quyền – chức vụ", type: "text", group: UNIT_GROUP },
  {
    code: "chi_huy_ky_ten",
    label: "Người có thẩm quyền ký (cấp bậc, họ tên)",
    type: "text",
    group: UNIT_GROUP,
    hint: "Ví dụ: Trung tá Nguyễn Văn A",
  },

  // Vụ việc
  { code: "ngay_vi_pham", label: "Ngày xảy ra vi phạm", type: "date", group: "Vụ việc" },
  { code: "gio_vi_pham", label: "Giờ xảy ra vi phạm", type: "time", group: "Vụ việc" },
  { code: "dia_diem_vi_pham", label: "Địa điểm xảy ra vi phạm", type: "text", group: "Vụ việc" },
  { code: "hanh_vi_vi_pham", label: "Hành vi vi phạm", type: "textarea", group: "Vụ việc" },
  {
    code: "can_cu_phap_ly",
    label: "Quy định tại (điều, khoản, điểm, văn bản)",
    type: "textarea",
    group: "Vụ việc",
  },
  { code: "ngay_tiep_nhan", label: "Ngày tiếp nhận", type: "date", group: "Vụ việc" },
  { code: "gio_tiep_nhan", label: "Giờ tiếp nhận", type: "time", group: "Vụ việc" },
  {
    code: "nguon_tin",
    label: "Hình thức tiếp nhận",
    type: "select",
    group: "Vụ việc",
    options: ["Trực tiếp", "Qua điện thoại", "Qua đơn thư", "Cơ quan, tổ chức chuyển đến", "Qua mạng"],
  },
  { code: "noi_dung_tin_bao", label: "Nội dung tin báo / sự việc", type: "textarea", group: "Vụ việc" },
  { code: "dien_bien", label: "Diễn biến sự việc", type: "textarea", group: "Vụ việc" },
  { code: "loi_khai", label: "Nội dung lời khai", type: "textarea", group: "Vụ việc" },
  { code: "ket_qua_hoa_giai", label: "Kết quả hòa giải", type: "textarea", group: "Vụ việc" },
  { code: "theo_lenh_so", label: "Theo Lệnh / Quyết định số", type: "text", group: "Vụ việc" },
  { code: "tu_ngay", label: "Thời hạn – từ ngày", type: "date", group: "Vụ việc" },
  { code: "den_ngay", label: "Thời hạn – đến ngày", type: "date", group: "Vụ việc" },
  { code: "noi_dung_cam_ket", label: "Nội dung cam kết", type: "textarea", group: "Vụ việc" },

  // Người vi phạm
  { code: "ho_ten", label: "Họ và tên", type: "text", group: "Người vi phạm / đối tượng", required: true },
  { code: "ten_goi_khac", label: "Tên gọi khác", type: "text", group: "Người vi phạm / đối tượng" },
  {
    code: "gioi_tinh",
    label: "Giới tính",
    type: "select",
    group: "Người vi phạm / đối tượng",
    options: ["Nam", "Nữ"],
  },
  { code: "ngay_sinh", label: "Ngày sinh", type: "date", group: "Người vi phạm / đối tượng" },
  {
    code: "so_dinh_danh",
    label: "Số định danh cá nhân / CCCD",
    type: "cccd",
    group: "Người vi phạm / đối tượng",
  },
  { code: "ngay_cap", label: "Ngày cấp", type: "date", group: "Người vi phạm / đối tượng" },
  { code: "noi_cap", label: "Nơi cấp", type: "text", group: "Người vi phạm / đối tượng" },
  {
    code: "quoc_tich",
    label: "Quốc tịch",
    type: "text",
    group: "Người vi phạm / đối tượng",
    defaultValue: "Việt Nam",
  },
  {
    code: "dan_toc",
    label: "Dân tộc",
    type: "text",
    group: "Người vi phạm / đối tượng",
    defaultValue: "Kinh",
  },
  { code: "nghe_nghiep", label: "Nghề nghiệp", type: "text", group: "Người vi phạm / đối tượng" },
  { code: "noi_thuong_tru", label: "Nơi thường trú", type: "text", group: "Người vi phạm / đối tượng" },
  { code: "noi_o_hien_tai", label: "Nơi ở hiện tại", type: "text", group: "Người vi phạm / đối tượng" },
  { code: "so_dien_thoai", label: "Số điện thoại", type: "phone", group: "Người vi phạm / đối tượng" },
  {
    code: "ton_giao",
    label: "Tôn giáo",
    type: "text",
    group: "Người vi phạm / đối tượng",
    defaultValue: "Không",
  },
  { code: "que_quan", label: "Quê quán", type: "text", group: "Người vi phạm / đối tượng" },
  { code: "noi_sinh", label: "Nơi sinh", type: "text", group: "Người vi phạm / đối tượng" },
  { code: "noi_tam_tru", label: "Nơi tạm trú", type: "text", group: "Người vi phạm / đối tượng" },
  { code: "noi_lam_viec", label: "Nơi làm việc", type: "text", group: "Người vi phạm / đối tượng" },
  { code: "hanh_vi_pham_toi", label: "Hành vi phạm tội", type: "text", group: "Người vi phạm / đối tượng" },
  { code: "tien_an_tien_su", label: "Tiền án, tiền sự", type: "text", group: "Người vi phạm / đối tượng" },

  // Người bị hại / liên quan
  { code: "nguoi_lien_quan_ho_ten", label: "Họ và tên", type: "text", group: "Người bị hại / liên quan" },
  { code: "nguoi_lien_quan_ngay_sinh", label: "Ngày sinh", type: "date", group: "Người bị hại / liên quan" },
  {
    code: "nguoi_lien_quan_so_dinh_danh",
    label: "Số định danh cá nhân / CCCD",
    type: "cccd",
    group: "Người bị hại / liên quan",
  },
  {
    code: "nguoi_lien_quan_noi_cu_tru",
    label: "Nơi cư trú",
    type: "text",
    group: "Người bị hại / liên quan",
  },
  {
    code: "nguoi_lien_quan_so_dien_thoai",
    label: "Số điện thoại",
    type: "phone",
    group: "Người bị hại / liên quan",
  },

  // Người chứng kiến
  { code: "nguoi_chung_kien_ho_ten", label: "Họ và tên", type: "text", group: "Người chứng kiến" },
  {
    code: "nguoi_chung_kien_so_dinh_danh",
    label: "Số định danh cá nhân / CCCD",
    type: "cccd",
    group: "Người chứng kiến",
  },
  { code: "nguoi_chung_kien_dia_chi", label: "Nơi cư trú", type: "text", group: "Người chứng kiến" },
  {
    code: "nguoi_dai_dien_ho_ten",
    label: "Người đại diện – họ tên",
    type: "text",
    group: "Người bị hại / liên quan",
  },

  // Tang vật
  {
    code: "co_tang_vat",
    label: "Có tạm giữ tang vật, phương tiện?",
    type: "boolean",
    group: "Tang vật, phương tiện",
  },
  {
    code: "tang_vat",
    label: "Danh sách tang vật, phương tiện",
    type: "table",
    group: "Tang vật, phương tiện",
    columns: [
      { code: "ten", label: "Tên, chủng loại", type: "text" },
      { code: "so_luong", label: "Số lượng", type: "number" },
      { code: "don_vi_tinh", label: "Đơn vị tính", type: "text" },
      { code: "tinh_trang", label: "Tình trạng, đặc điểm", type: "text" },
    ],
  },
  { code: "noi_tam_giu", label: "Nơi tạm giữ", type: "text", group: "Tang vật, phương tiện" },
  {
    code: "thoi_han_tam_giu",
    label: "Thời hạn tạm giữ",
    type: "text",
    group: "Tang vật, phương tiện",
    defaultValue: "07 ngày",
  },

  // Xử lý
  {
    code: "hinh_thuc_xu_phat",
    label: "Hình thức xử phạt chính",
    type: "select",
    group: "Xử lý",
    options: ["Cảnh cáo", "Phạt tiền"],
  },
  { code: "muc_phat", label: "Mức phạt", type: "money", group: "Xử lý" },
  { code: "bien_phap_khac_phuc", label: "Biện pháp khắc phục hậu quả", type: "textarea", group: "Xử lý" },
  { code: "noi_nop_phat", label: "Nơi nộp tiền phạt", type: "text", group: "Xử lý" },
  {
    code: "thoi_han_thi_hanh",
    label: "Thời hạn chấp hành",
    type: "text",
    group: "Xử lý",
    defaultValue: "10 ngày",
  },
  { code: "y_kien_nguoi_vi_pham", label: "Ý kiến của người vi phạm", type: "textarea", group: "Xử lý" },
]

export const BUILTIN_FIELDS: FieldDef[] = SEED.map((f, i) => ({
  ...f,
  required: f.required ?? false,
  order: i,
}))

/** Thẻ hệ thống, tự tính, không cần nhập. */
export const SYSTEM_TAGS = new Set([
  "hom_nay",
  "hom_nay_chu",
  "hom_nay_ngay",
  "hom_nay_thang",
  "hom_nay_nam",
  "stt",
])

export const DERIVED_SUFFIXES = ["_ngay", "_thang", "_nam", "_gio", "_phut", "_chu", "_hoa"] as const
const DATE_SUFFIXES = new Set(["_ngay", "_thang", "_nam"])
const TIME_SUFFIXES = new Set(["_gio", "_phut"])
const WORDABLE_TYPES = new Set<FieldType>(["date", "time", "money", "number", "boolean"])

/** Danh sách hậu tố có thể dùng cho từng kiểu trường (để hiển thị hướng dẫn). */
export const SUFFIX_HELP: Partial<Record<FieldType, { suffix: string; example: string }[]>> = {
  date: [
    { suffix: "", example: "05/03/2026" },
    { suffix: "_chu", example: "ngày 05 tháng 3 năm 2026" },
    { suffix: "_ngay", example: "05" },
    { suffix: "_thang", example: "3" },
    { suffix: "_nam", example: "2026" },
  ],
  time: [
    { suffix: "", example: "14:30" },
    { suffix: "_chu", example: "14 giờ 30 phút" },
    { suffix: "_gio", example: "14" },
    { suffix: "_phut", example: "30" },
  ],
  money: [
    { suffix: "", example: "1.500.000" },
    { suffix: "_chu", example: "Một triệu năm trăm nghìn đồng" },
  ],
  number: [
    { suffix: "", example: "12" },
    { suffix: "_chu", example: "Mười hai" },
  ],
  text: [
    { suffix: "", example: "Nguyễn Văn A" },
    { suffix: "_hoa", example: "NGUYỄN VĂN A" },
  ],
  boolean: [
    { suffix: "", example: "{#ma}…{/ma} hiện khi chọn Có; {^ma}…{/ma} hiện khi chọn Không" },
    { suffix: "_chu", example: "Có / Không" },
  ],
}

const HUMANIZE_WORDS: Record<string, string> = {
  ho: "họ",
  ten: "tên",
  ngay: "ngày",
  gio: "giờ",
  so: "số",
  noi: "nơi",
  dia: "địa",
  chi: "chỉ",
  diem: "điểm",
  vi: "vi",
  pham: "phạm",
  nguoi: "người",
  tien: "tiền",
  muc: "mức",
  phat: "phạt",
  co: "có",
  quan: "quan",
  don: "đơn",
  can: "cán",
  bo: "bộ",
  ly: "lý",
  do: "do",
  ket: "kết",
  qua: "quả",
  y: "ý",
  kien: "kiến",
  noi_dung: "nội dung",
}

/** "ngay_tam_giu" → "Ngày tam giu" (gợi ý nhãn, người dùng sửa lại). */
export const humanizeCode = (code: string): string => {
  const words = code.split("_").filter(Boolean)
  const text = words.map((w) => HUMANIZE_WORDS[w] ?? w).join(" ")
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : code
}

/** Đoán kiểu dữ liệu từ mã trường. */
export const inferType = (code: string): FieldType => {
  const c = code.toLowerCase()
  if (c.startsWith("ngay_") || c.endsWith("_ngay_sinh") || c === "ngay") {
    return "date"
  }
  if (c.startsWith("gio_") || c.startsWith("thoi_gian_gio")) {
    return "time"
  }
  if (c.includes("so_tien") || c.startsWith("muc_phat") || c.startsWith("tien_")) {
    return "money"
  }
  if (c.includes("dinh_danh") || c.includes("cccd") || c.includes("cmnd")) {
    return "cccd"
  }
  if (c.includes("dien_thoai") || c.startsWith("sdt")) {
    return "phone"
  }
  if (c.startsWith("co_") || c.startsWith("la_")) {
    return "boolean"
  }
  if (
    c.startsWith("noi_dung") ||
    c.startsWith("dien_bien") ||
    c.startsWith("ly_do") ||
    c.startsWith("y_kien") ||
    c.startsWith("ket_qua") ||
    c.startsWith("loi_khai") ||
    c.startsWith("nhan_xet")
  ) {
    return "textarea"
  }
  if (c.startsWith("so_luong") || c.startsWith("tuoi")) {
    return "number"
  }
  return "text"
}

const inferColumnType = (code: string): ColumnDef["type"] => {
  const t = inferType(code)
  return t === "table" || t === "boolean" || t === "textarea" ? "text" : t
}

export const inferGroup = (code: string): string => {
  if (code.startsWith("nguoi_lien_quan") || code.startsWith("bi_hai")) {
    return "Người bị hại / liên quan"
  }
  if (code.startsWith("nguoi_chung_kien")) {
    return "Người chứng kiến"
  }
  if (code.startsWith("can_bo") || code.startsWith("chi_huy")) {
    return UNIT_GROUP
  }
  return DEFAULT_GROUP
}

/**
 * Quy thẻ trong mẫu về mã trường gốc.
 * Ví dụ: "ngay_vi_pham_chu" → "ngay_vi_pham", "ho_ten_hoa" → "ho_ten".
 */
export const resolveTag = (tag: string, known: Set<string>, siblings: Set<string>): string => {
  if (known.has(tag)) {
    return tag
  }
  for (const suffix of DERIVED_SUFFIXES) {
    if (tag.endsWith(suffix) && tag.length > suffix.length) {
      const base = tag.slice(0, -suffix.length)
      if (known.has(base) || siblings.has(base)) {
        return base
      }
      if (DATE_SUFFIXES.has(suffix) && base.startsWith("ngay")) {
        return base
      }
      if (TIME_SUFFIXES.has(suffix) && base.startsWith("gio")) {
        return base
      }
      if (suffix === "_chu" && WORDABLE_TYPES.has(inferType(base))) {
        return base
      }
    }
  }
  return tag
}

export interface ResolvedTemplateFields {
  /** Mã trường gốc theo thứ tự xuất hiện. */
  codes: string[]
  /** Định nghĩa mới cần thêm vào từ điển (chưa có). */
  newFields: FieldDef[]
}

/**
 * Từ thẻ đọc được trong mẫu, xác định danh sách trường gốc và tạo định nghĩa
 * cho các trường chưa có trong từ điển.
 */
export const resolveTemplateFields = (
  tags: TemplateTags,
  dictionary: Map<string, FieldDef>
): ResolvedTemplateFields => {
  const known = new Set(dictionary.keys())
  const siblings = new Set([...tags.simple, ...tags.sections.map((s) => s.name)])
  const codes: string[] = []
  const newFields = new Map<string, FieldDef>()
  let order = 10_000

  const addCode = (code: string) => {
    if (SYSTEM_TAGS.has(code) || codes.includes(code)) {
      return
    }
    codes.push(code)
  }

  const ensureSimple = (tag: string) => {
    if (SYSTEM_TAGS.has(tag)) {
      return
    }
    const code = resolveTag(tag, known, siblings)
    addCode(code)
    if (!(known.has(code) || newFields.has(code))) {
      order += 1
      newFields.set(code, {
        code,
        label: humanizeCode(code),
        type: inferType(code),
        group: inferGroup(code),
        required: false,
        order,
        autoDetected: true,
      })
    }
  }

  for (const section of tags.sections) {
    // {x}{^x}……{/x}: khối giữ chỗ chấm khi để trống – không phải trường riêng.
    if (section.children.length === 0 && tags.simple.includes(section.name)) {
      ensureSimple(section.name)
      continue
    }
    const existing = dictionary.get(section.name) ?? newFields.get(section.name)
    const looksBoolean =
      existing?.type === "boolean" ||
      (!existing &&
        (section.name.startsWith("co_") || section.name.startsWith("la_") || section.children.length === 0))

    if (looksBoolean) {
      addCode(section.name)
      if (!existing) {
        order += 1
        newFields.set(section.name, {
          code: section.name,
          label: `${humanizeCode(section.name)}?`,
          type: "boolean",
          group: inferGroup(section.name),
          required: false,
          order,
          autoDetected: true,
        })
      }
      // Thẻ bên trong khối điều kiện là trường thường.
      for (const child of section.children) {
        ensureSimple(child)
      }
    } else {
      addCode(section.name)
      if (!existing) {
        order += 1
        const colSiblings = new Set(section.children)
        const colCodes = [
          ...new Set(
            section.children
              .filter((c) => !SYSTEM_TAGS.has(c))
              .map((c) => resolveTag(c, new Set(), colSiblings))
          ),
        ]
        newFields.set(section.name, {
          code: section.name,
          label: humanizeCode(section.name),
          type: "table",
          group: inferGroup(section.name),
          required: false,
          order,
          autoDetected: true,
          columns: colCodes.map((c) => ({ code: c, label: humanizeCode(c), type: inferColumnType(c) })),
        })
      }
    }
  }

  for (const tag of tags.simple) {
    ensureSimple(tag)
  }

  return { codes, newFields: [...newFields.values()] }
}

export const groupIndex = (group: string): number => {
  const i = (GROUPS as readonly string[]).indexOf(group)
  return i === -1 ? GROUPS.length : i
}

export const sortFields = (fields: FieldDef[]): FieldDef[] =>
  [...fields].sort((a, b) => groupIndex(a.group) - groupIndex(b.group) || a.order - b.order)
