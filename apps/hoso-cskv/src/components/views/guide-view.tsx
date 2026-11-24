import { LightbulbIcon, LockIcon } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BUILTIN_FIELDS, GROUPS } from "@/lib/fields"
import { FIELD_TYPE_LABELS } from "@/lib/types"

const Code = ({ children }: { children: string }) => (
  <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>
)

const Example = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-muted/40 rounded-lg border p-4 font-serif text-[15px] leading-relaxed">{children}</div>
)

const Tip = ({ children }: { children: React.ReactNode }) => (
  <div className="border-primary/25 bg-primary/5 flex gap-3 rounded-lg border p-3 text-sm">
    <LightbulbIcon className="text-primary mt-0.5 size-4 shrink-0" />
    <div>{children}</div>
  </div>
)

const SUFFIXES = [
  ["{ngay_lap}", "05/03/2026", "Ngày tháng"],
  ["{ngay_lap_chu}", "ngày 05 tháng 3 năm 2026", "Ngày tháng"],
  ["{ngay_lap_ngay} / _thang / _nam", "05 / 3 / 2026", "Ngày tháng"],
  ["{gio_lap_chu}", "14 giờ 30 phút", "Giờ phút"],
  ["{gio_lap_gio} / _phut", "14 / 30", "Giờ phút"],
  ["{muc_phat}", "1.500.000", "Số tiền"],
  ["{muc_phat_chu}", "Một triệu năm trăm nghìn đồng", "Số tiền"],
  ["{ho_ten_hoa}", "NGUYỄN VĂN A", "Chữ"],
  ["{co_tang_vat_chu}", "Có / Không", "Có / Không"],
  ["{hom_nay_chu}", "ngày hôm nay bằng chữ", "Hệ thống"],
] as const

export const GuideView = () => (
  <div className="max-w-4xl space-y-6">
    <PageHeader
      description="Cách chuẩn bị biểu mẫu Word để phần mềm tự tạo bảng nhập liệu và dựng hồ sơ."
      title="Hướng dẫn sử dụng"
    />

    <Card>
      <CardHeader>
        <CardTitle>1. Đánh dấu chỗ cần điền trong file Word</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-relaxed">
        <p>
          Mở biểu mẫu bằng Word, thay mỗi chỗ “……” cần điền bằng một <strong>thẻ</strong> gồm mã trường đặt
          trong dấu ngoặc nhọn. Mã viết thường, không dấu, nối bằng dấu gạch dưới. Định dạng (đậm, nghiêng, cỡ
          chữ) của thẻ sẽ được giữ cho nội dung điền vào.
        </p>
        <Example>
          Họ và tên: <strong>{"{ho_ten_hoa}"}</strong>; Giới tính: {"{gioi_tinh}"}
          <br />
          Ngày, tháng, năm sinh: {"{ngay_sinh}"}; Số định danh cá nhân: {"{so_dinh_danh}"}
          <br />
          {"{dia_danh}"}, {"{ngay_lap_chu}"}
        </Example>
        <Tip>
          Nên dùng các mã có sẵn trong <strong>Từ điển trường</strong> (bảng cuối trang). Mã mới chưa có sẽ
          được tự thêm vào từ điển, sau đó bạn chỉ cần sửa lại nhãn tiếng Việt và kiểu dữ liệu.
        </Tip>
        <p>
          Lưu file dạng <strong>.docx</strong> rồi vào mục <strong>Biểu mẫu → Thêm biểu mẫu</strong>. Cùng một
          mã ở nhiều biểu mẫu sẽ chỉ phải nhập <strong>một lần</strong>.
        </p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>2. Định dạng tự động (hậu tố)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>Nhập một lần, in ra nhiều kiểu bằng cách thêm hậu tố vào sau mã trường:</p>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full">
            <thead className="bg-muted/60 text-muted-foreground text-left text-xs">
              <tr>
                <th className="px-3 py-2 font-medium" scope="col">
                  Thẻ trong Word
                </th>
                <th className="px-3 py-2 font-medium" scope="col">
                  In ra
                </th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell" scope="col">
                  Kiểu trường
                </th>
              </tr>
            </thead>
            <tbody>
              {SUFFIXES.map(([tag, out, type]) => (
                <tr className="border-t" key={tag}>
                  <td className="px-3 py-2 font-mono text-xs">{tag}</td>
                  <td className="px-3 py-2">{out}</td>
                  <td className="text-muted-foreground hidden px-3 py-2 sm:table-cell">{type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground">
          Theo thể thức văn bản hành chính, ngày nhỏ hơn 10 và tháng 1, 2 được thêm số 0 phía trước.
        </p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>3. Đoạn văn có điều kiện</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-relaxed">
        <p>
          Dùng trường kiểu <strong>Có / Không</strong> (mã nên bắt đầu bằng <Code>co_</Code>). Đoạn giữa{" "}
          <Code>{"{#ma}"}</Code> và <Code>{"{/ma}"}</Code> chỉ hiện khi chọn <em>Có</em>; đoạn giữa{" "}
          <Code>{"{^ma}"}</Code> và <Code>{"{/ma}"}</Code> chỉ hiện khi chọn <em>Không</em>.
        </p>
        <Example>
          {"{#co_tang_vat}"}Tang vật, phương tiện bị tạm giữ theo biên bản lập cùng ngày.{"{/co_tang_vat}"}
          <br />
          {"{^co_tang_vat}"}Không tạm giữ tang vật, phương tiện.{"{/co_tang_vat}"}
        </Example>
        <Tip>
          Trong mục <strong>Loại hồ sơ</strong>, có thể đặt cả một văn bản “Chỉ khi: Có tạm giữ tang vật” để
          văn bản đó chỉ được tạo khi cần.
        </Tip>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>4. Bảng nhiều dòng (danh sách)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-relaxed">
        <p>
          Trong bảng Word, tạo <strong>một dòng mẫu</strong>: ô đầu tiên mở bằng <Code>{"{#tang_vat}"}</Code>,
          ô cuối đóng bằng <Code>{"{/tang_vat}"}</Code>. Dòng này sẽ được nhân lên theo số dòng bạn nhập. Dùng{" "}
          <Code>{"{stt}"}</Code> để đánh số thứ tự.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border text-center font-serif text-[14px]">
            <thead>
              <tr className="bg-muted/50">
                {["STT", "Tên, chủng loại", "Số lượng", "Đơn vị tính", "Tình trạng"].map((h) => (
                  <th className="border px-2 py-1.5 font-semibold" key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border px-2 py-1.5">{"{#tang_vat}{stt}"}</td>
                <td className="border px-2 py-1.5">{"{ten}"}</td>
                <td className="border px-2 py-1.5">{"{so_luong}"}</td>
                <td className="border px-2 py-1.5">{"{don_vi_tinh}"}</td>
                <td className="border px-2 py-1.5">{"{tinh_trang}{/tang_vat}"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>5. Lưu ý khi tạo hồ sơ</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm leading-relaxed">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Trường bỏ trống sẽ được in thành “……………………” để viết tay bổ sung.</li>
          <li>Hồ sơ được tự động lưu trong lúc nhập; có thể đóng và mở lại bất cứ lúc nào.</li>
          <li>
            “Tạo trọn bộ (.zip)” xuất mỗi văn bản thành một file Word, đánh số theo thứ tự trong loại hồ sơ.
            Có thể mở bằng Word để chỉnh sửa trước khi in.
          </li>
          <li>Thông tin đơn vị, cán bộ khai báo trong Cài đặt sẽ được điền sẵn cho hồ sơ mới.</li>
          <li>
            Khi biểu mẫu thay đổi theo văn bản mới, dùng “Thay file (phiên bản mới)” để cập nhật mà không cần
            làm lại loại hồ sơ.
          </li>
        </ul>
      </CardContent>
    </Card>

    <Card className="border-success/40">
      <CardHeader className="flex-row items-center gap-2">
        <LockIcon className="text-success size-4" />
        <CardTitle>Bảo mật dữ liệu</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm leading-relaxed">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            Phần mềm chạy hoàn toàn trong trình duyệt. Biểu mẫu và hồ sơ chỉ lưu trên máy đang dùng, không gửi
            lên máy chủ hay dịch vụ nào.
          </li>
          <li>
            Dữ liệu có thể mất nếu xóa lịch sử / dữ liệu trình duyệt: hãy sao lưu định kỳ trong mục Cài đặt.
          </li>
          <li>
            Không nhập tài liệu thuộc bí mật nhà nước; tuân thủ quy định về bảo vệ dữ liệu cá nhân và quy định
            của ngành.
          </li>
          <li>Các biểu mẫu kèm theo chỉ là mẫu minh họa, cần thay bằng biểu mẫu chính thức đang áp dụng.</li>
        </ul>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Mã trường có sẵn</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {GROUPS.map((g) => {
          const list = BUILTIN_FIELDS.filter((f) => f.group === g)
          if (list.length === 0) {
            return null
          }
          return (
            <div key={g}>
              <h3 className="mb-2 text-sm font-semibold">{g}</h3>
              <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {list.map((f) => (
                  <div
                    className="flex items-baseline justify-between gap-3 border-b border-dashed py-1 text-sm"
                    key={f.code}
                  >
                    <span>
                      {f.label}
                      <span className="text-muted-foreground ml-1.5 text-xs">
                        ({FIELD_TYPE_LABELS[f.type]})
                      </span>
                    </span>
                    <code className="text-primary shrink-0 font-mono text-xs">{`{${f.code}}`}</code>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  </div>
)
