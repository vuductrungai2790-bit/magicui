/**
 * Bảng nhãn thường gặp trong biểu mẫu → mã trường, dùng khi tự nhận diện chỗ cần điền.
 * Nhãn được so khớp sau khi bỏ dấu, viết thường.
 */
import type { FieldType } from "./types"
import { removeDiacritics } from "./vn"

/** Mã trường "thuộc về một người" – đổi tiền tố theo người đang được nhắc tới. */
const PERSON_FIELDS = new Set([
  "ho_ten",
  "ten_goi_khac",
  "ngay_sinh",
  "gioi_tinh",
  "quoc_tich",
  "dan_toc",
  "ton_giao",
  "nghe_nghiep",
  "noi_lam_viec",
  "noi_thuong_tru",
  "noi_tam_tru",
  "noi_o_hien_tai",
  "que_quan",
  "noi_sinh",
  "so_dinh_danh",
  "ngay_cap",
  "noi_cap",
  "so_dien_thoai",
  "cap_bac",
  "chuc_vu",
  "dia_chi",
])

const SYNONYMS: [string[], string][] = [
  [
    ["ho va ten", "ho ten", "ho va ten khai sinh", "toi", "ong/ba", "ong (ba)", "ong, ba", "ba/ong"],
    "ho_ten",
  ],
  [["ten goi khac", "ten khac", "bi danh"], "ten_goi_khac"],
  [["ngay sinh", "sinh ngay", "ngay, thang, nam sinh", "ngay thang nam sinh"], "ngay_sinh"],
  [["gioi tinh"], "gioi_tinh"],
  [["quoc tich"], "quoc_tich"],
  [["dan toc"], "dan_toc"],
  [["ton giao"], "ton_giao"],
  [["nghe nghiep"], "nghe_nghiep"],
  [["noi lam viec", "noi cong tac"], "noi_lam_viec"],
  [["noi thuong tru", "noi dang ky thuong tru", "thuong tru", "dia chi thuong tru"], "noi_thuong_tru"],
  [["noi tam tru", "tam tru"], "noi_tam_tru"],
  [["noi o hien tai", "noi o hien nay", "cho o hien nay", "cho o hien tai", "noi o"], "noi_o_hien_tai"],
  [["que quan", "nguyen quan"], "que_quan"],
  [["noi sinh", "tai"], "noi_sinh"],
  [
    [
      "so cccd",
      "so cc/cccd/ho chieu",
      "so cccd/cc/ho chieu",
      "so cccd/ho chieu",
      "so dinh danh",
      "so dinh danh ca nhan",
      "so cmnd",
      "so cmnd/cccd",
      "so can cuoc",
      "so can cuoc cong dan",
      "cccd",
      "so cc",
    ],
    "so_dinh_danh",
  ],
  [["ngay cap", "cap ngay"], "ngay_cap"],
  [["noi cap"], "noi_cap"],
  [["so dien thoai", "so dien thoai lien he", "dien thoai", "sdt", "so dt"], "so_dien_thoai"],
  [["cap bac"], "cap_bac"],
  [["chuc vu"], "chuc_vu"],
  [["dia chi"], "dia_chi"],
  [["don vi", "don vi cong tac"], "ten_don_vi"],
  [["ten toi la"], "can_bo_ho_ten"],
  [["hanh vi pham toi", "toi danh"], "hanh_vi_pham_toi"],
  [["hanh vi vi pham", "hanh vi vi pham hanh chinh"], "hanh_vi_vi_pham"],
  [["tien an, tien su", "tien an tien su"], "tien_an_tien_su"],
  [["kinh gui"], "kinh_gui"],
  [["so"], "so_van_ban"],
]

const SYNONYM_MAP = new Map<string, string>()
for (const [labels, code] of SYNONYMS) {
  for (const l of labels) {
    SYNONYM_MAP.set(l, code)
  }
}

/** Nhãn không phải chỗ điền (đề mục, căn cứ…). */
const SKIP_LABELS = new Set([
  "noi nhan",
  "can cu",
  "quyet dinh",
  "noi dung",
  "chung toi gom",
  "chung toi gom co",
  "thanh phan",
  "ket luan",
  "de nghi",
  "kien nghi",
  "luu",
  "noi gui",
])

const PUNCT_EDGES = /^[\s\-–•*]+|[\s(*)]+$/g
const FOOTNOTE = /\s+\d{1,2}$/
const SPACES = /\s+/g

export const normalizeLabel = (label: string): string =>
  removeDiacritics(label)
    .toLowerCase()
    .replace(PUNCT_EDGES, "")
    .replace(FOOTNOTE, "")
    .replace(SPACES, " ")
    .trim()

/** Nhãn ngắn dễ nhầm ("Số", "Tôi", "tại"): chỉ nhận khi đứng đầu cụm, không có chữ khác ngay trước. */
export const AMBIGUOUS_LABELS = new Set(["so", "toi", "tai"])

export const lookupLabel = (label: string): string | undefined => SYNONYM_MAP.get(normalizeLabel(label))

export const isSkippedLabel = (label: string): boolean => SKIP_LABELS.has(normalizeLabel(label))

/** Độ dài tối đa (số từ) của một nhãn có trong bảng – để tìm nhãn từ cuối đoạn văn lên. */
export const MAX_LABEL_WORDS = 6

export type Subject = "doi_tuong" | "can_bo" | "chung_kien" | "lien_quan"

const SUBJECT_PREFIX: Record<Subject, string> = {
  doi_tuong: "",
  can_bo: "can_bo_",
  chung_kien: "nguoi_chung_kien_",
  lien_quan: "nguoi_lien_quan_",
}

export const SUBJECT_GROUP: Record<Subject, string> = {
  doi_tuong: "Người vi phạm / đối tượng",
  can_bo: "Đơn vị & cán bộ",
  chung_kien: "Người chứng kiến",
  lien_quan: "Người bị hại / liên quan",
}

const SUBJECT_KEYWORDS: [Subject, string[]][] = [
  ["can_bo", ["phan cong dong chi", "chung toi gom", "ten toi la", "chung toi:", "dong chi:"]],
  [
    "doi_tuong",
    [
      "nguoi bi ",
      "doi voi",
      "bi can",
      "bi cao",
      "lam viec voi",
      "thong tin nguoi",
      "nguoi vi pham",
      "ca nhan vi pham",
      "nguoi phai thi hanh",
      "nguoi duoc",
    ],
  ],
  ["chung_kien", ["chung kien"]],
  ["lien_quan", ["bi hai", "nguoi lien quan", "nguoi bao tin", "nguoi cung cap", "nguoi to giac"]],
]

/** Đoạn văn có nhắc tới ai → người mà các nhãn phía sau thuộc về. */
export const detectSubject = (paragraphText: string): Subject | null => {
  const t = removeDiacritics(paragraphText).toLowerCase()
  let best: { subject: Subject; pos: number } | null = null
  for (const [subject, words] of SUBJECT_KEYWORDS) {
    for (const w of words) {
      const pos = t.lastIndexOf(w)
      if (pos !== -1 && (!best || pos > best.pos)) {
        best = { subject, pos }
      }
    }
  }
  return best?.subject ?? null
}

/** Áp người đang nhắc tới vào mã trường gốc. */
export const applySubject = (code: string, subject: Subject): string => {
  if (!PERSON_FIELDS.has(code)) {
    return code
  }
  return `${SUBJECT_PREFIX[subject]}${code}`
}

export const groupForCode = (code: string, subject: Subject): string => {
  if (code.startsWith("can_bo") || code.startsWith("chi_huy") || code === "ten_don_vi") {
    return SUBJECT_GROUP.can_bo
  }
  if (code.startsWith("nguoi_chung_kien")) {
    return SUBJECT_GROUP.chung_kien
  }
  if (code.startsWith("nguoi_lien_quan")) {
    return SUBJECT_GROUP.lien_quan
  }
  if (PERSON_FIELDS.has(code)) {
    return SUBJECT_GROUP[subject]
  }
  return "Vụ việc"
}

export const DATE_CODES = new Set(["ngay_sinh", "ngay_cap"])

export const typeForCode = (code: string, fallback: FieldType): FieldType => {
  const base = code.replace(/^(can_bo_|nguoi_chung_kien_|nguoi_lien_quan_)/, "")
  if (DATE_CODES.has(base)) {
    return "date"
  }
  if (base === "so_dinh_danh") {
    return "cccd"
  }
  if (base === "so_dien_thoai") {
    return "phone"
  }
  if (base === "gioi_tinh") {
    return "select"
  }
  if (base === "tien_an_tien_su") {
    return "text"
  }
  return fallback
}
