# Hồ sơ CSKV – Trợ lý lập hồ sơ theo biểu mẫu

Ứng dụng web giúp Cảnh sát khu vực lập nhanh các bộ hồ sơ gồm nhiều văn bản:

1. **Biểu mẫu**: tải file Word (.docx) đã đánh dấu các chỗ cần điền bằng `{ten_truong}`.
2. **Loại hồ sơ**: gom nhiều biểu mẫu thành một bộ, sắp thứ tự, đặt điều kiện (ví dụ: chỉ tạo biên bản tạm giữ khi có tang vật).
3. **Lập hồ sơ**: phần mềm gộp mọi trường của cả bộ thành **một bảng nhập duy nhất** (mỗi thông tin nhập một lần), rồi tạo trọn bộ file Word (.zip), xem trước và in.

## Tính năng

- Tự nhận diện thẻ trong file Word; tự thêm trường mới vào **Từ điển trường** (đoán kiểu dữ liệu từ mã).
- Hậu tố định dạng tự động: `_chu` (ngày/giờ/số tiền bằng chữ), `_ngay`, `_thang`, `_nam`, `_gio`, `_phut`, `_hoa` (VIẾT HOA).
- Đoạn văn có điều kiện `{#co_...}…{/co_...}`, bảng nhiều dòng `{#tang_vat}…{/tang_vat}` với `{stt}`.
- Trường bỏ trống in thành “……………………” để viết tay bổ sung.
- Tự lưu, tìm kiếm không dấu, nhân bản hồ sơ, nhắc hạn, đánh dấu hoàn thành.
- Thông tin đơn vị/cán bộ điền sẵn; sao lưu – khôi phục bằng file .json.
- Giao diện sáng / tối / theo hệ thống, dùng được trên máy tính và điện thoại.

## Bảo mật

Ứng dụng là trang tĩnh, chạy hoàn toàn trong trình duyệt: biểu mẫu và hồ sơ lưu trong IndexedDB của máy đang dùng,
**không gửi dữ liệu lên máy chủ nào**. Có thể đặt trên máy chủ nội bộ hoặc chạy trên một máy không có Internet.
Hãy sao lưu định kỳ (mục Cài đặt). Các biểu mẫu trong `public/mau` chỉ là **mẫu minh họa**.

## Chạy

```bash
pnpm install --filter hoso-cskv
pnpm --filter hoso-cskv dev      # http://localhost:3100
pnpm --filter hoso-cskv build    # xuất trang tĩnh vào thư mục out/
pnpm --filter hoso-cskv test     # kiểm thử đọc số, ngày tháng, nhận diện & ghép mẫu
pnpm --filter hoso-cskv gen:mau  # tạo lại các biểu mẫu minh họa
```

Thư mục `out/` sau khi build có thể chép lên bất kỳ máy chủ web tĩnh nào (IIS, Nginx…) hoặc chạy `npx serve out`.

## Cấu trúc

```
src/lib/vn.ts        đọc số, ngày giờ tiếng Việt
src/lib/fields.ts    từ điển trường có sẵn, đoán kiểu, quy thẻ về trường gốc
src/lib/docx.ts      đọc thẻ & ghép dữ liệu vào Word (docxtemplater)
src/lib/dossier.ts   gộp trường, tạo hồ sơ, xuất bộ .zip
src/lib/db.ts        cơ sở dữ liệu IndexedDB (Dexie)
src/components/      giao diện
src/app/             các trang
```
