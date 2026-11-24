/**
 * Đóng gói phần mềm thành HoSoCSKV.zip để chép sang máy khác:
 * giải nén rồi bấm đúp MO-PHAN-MEM.html là dùng được, không cần cài đặt hay Internet.
 *
 * Chạy: pnpm dong-goi   (sau khi đã build: pnpm build)
 */
import { readdir, readFile, stat, writeFile } from "node:fs/promises"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

import JSZip from "jszip"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const OUT = join(ROOT, "out")
const ZIP_PATH = join(ROOT, "HoSoCSKV.zip")
const FOLDER = "HoSoCSKV"
const APP_DIR = "ung-dung"

const LAUNCHER = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=${APP_DIR}/index.html#/">
<title>Hồ sơ CSKV</title>
</head>
<body style="font-family:Segoe UI,Arial,sans-serif;padding:40px">
<p>Đang mở phần mềm… Nếu không tự mở, <a href="${APP_DIR}/index.html#/">bấm vào đây</a>.</p>
</body>
</html>
`

const GUIDE = `HỒ SƠ CSKV - TRỢ LÝ LẬP HỒ SƠ
==============================

CÁCH MỞ PHẦN MỀM
1. Giải nén file HoSoCSKV.zip (bấm chuột phải > "Extract All..." / "Giải nén tất cả").
2. Mở thư mục HoSoCSKV vừa giải nén.
3. Bấm đúp vào file MO-PHAN-MEM.html
   -> Phần mềm mở trong trình duyệt (nên dùng Google Chrome hoặc Microsoft Edge).
4. Lần đầu: ở trang Tổng quan bấm "Nạp dữ liệu minh họa" để có sẵn mẫu dùng thử.

Mẹo: chuột phải MO-PHAN-MEM.html > "Send to" > "Desktop (create shortcut)"
để có biểu tượng ngoài màn hình nền.

LƯU Ý QUAN TRỌNG
- Không cần cài đặt, không cần Internet.
- Dữ liệu lưu ngay trong trình duyệt của máy này, KHÔNG gửi đi đâu.
- Luôn mở bằng CÙNG MỘT trình duyệt (ví dụ luôn dùng Chrome) thì mới thấy dữ liệu cũ.
- Nếu xóa lịch sử/dữ liệu duyệt web thì dữ liệu phần mềm cũng mất:
  hãy vào mục Cài đặt > "Tải file sao lưu" định kỳ và cất file sao lưu cẩn thận.
- Có thể chép cả thư mục HoSoCSKV sang USB/máy khác; dữ liệu thì chuyển bằng
  file sao lưu (Cài đặt > Khôi phục từ file).
- Các biểu mẫu kèm theo chỉ là MẪU MINH HỌA, cần thay bằng biểu mẫu chính thức.
`

const walk = async (dir) => {
  const out = []
  for (const name of await readdir(dir)) {
    const full = join(dir, name)
    if ((await stat(full)).isDirectory()) {
      out.push(...(await walk(full)))
    } else {
      out.push(full)
    }
  }
  return out
}

const zip = new JSZip()
const folder = zip.folder(FOLDER)
folder.file("MO-PHAN-MEM.html", LAUNCHER)
folder.file("HUONG-DAN.txt", `\uFEFF${GUIDE.replace(/\n/g, "\r\n")}`)
const files = await walk(OUT)
for (const f of files) {
  folder.file(`${APP_DIR}/${relative(OUT, f).split("\\").join("/")}`, await readFile(f))
}
const buffer = await zip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
  compressionOptions: { level: 9 },
})
await writeFile(ZIP_PATH, buffer)
process.stdout.write(
  `✓ ${relative(ROOT, ZIP_PATH)} (${files.length} tệp, ${(buffer.length / 1024 / 1024).toFixed(1)} MB)\n`
)
