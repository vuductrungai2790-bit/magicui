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
Hãy sao lưu định kỳ (mục Cài đặt). Các biểu mẫu kèm theo chỉ là **mẫu minh họa**.

## Dùng phần mềm (không cần cài đặt)

1. Tải file **HoSoCSKV.zip**, giải nén.
2. Mở thư mục `HoSoCSKV`, bấm đúp **MO-PHAN-MEM.html** (nên dùng Chrome hoặc Edge).
3. Lần đầu: bấm **“Nạp dữ liệu minh họa”** ở trang Tổng quan để dùng thử.

Phần mềm chạy ngay từ file, không cần máy chủ, không cần Internet. Luôn mở bằng cùng một trình duyệt
để thấy dữ liệu cũ; sao lưu định kỳ trong mục Cài đặt.

## Dành cho người phát triển

```bash
pnpm install --filter hoso-cskv
pnpm --filter hoso-cskv dev       # http://localhost:3100
pnpm --filter hoso-cskv dong-goi  # build và tạo HoSoCSKV.zip để phát cho người dùng
pnpm --filter hoso-cskv test      # kiểm thử đọc số, ngày tháng, nhận diện & ghép mẫu
pnpm --filter hoso-cskv gen:mau   # tạo lại các biểu mẫu minh họa (src/lib/sample-files.ts)
```

Định tuyến dùng dấu `#` (ví dụ `index.html#/ho-so/`) để chạy được khi mở trực tiếp file; thư mục `out/` cũng
có thể đặt trên bất kỳ máy chủ web tĩnh nào.

## Cấu trúc

```
src/lib/vn.ts        đọc số, ngày giờ tiếng Việt
src/lib/fields.ts    từ điển trường có sẵn, đoán kiểu, quy thẻ về trường gốc
src/lib/docx.ts      đọc thẻ & ghép dữ liệu vào Word (docxtemplater)
src/lib/dossier.ts   gộp trường, tạo hồ sơ, xuất bộ .zip
src/lib/db.ts        cơ sở dữ liệu IndexedDB (Dexie)
src/lib/router.tsx   định tuyến bằng dấu #
src/components/router-view.tsx  danh sách các trang
src/components/      giao diện
src/app/             các trang
```
