"use client"

import { useLiveQuery } from "dexie-react-hooks"
import {
  AlarmClockIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  FilePenLineIcon,
  FileTextIcon,
  LayersIcon,
  ShieldCheckIcon,
} from "lucide-react"
import Link from "next/link"

import { PageHeader } from "@/components/page-header"
import { SampleDataButton } from "@/components/sample-data-button"
import { DossierTypePicker } from "@/components/views/create-dossier-view"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { db } from "@/lib/db"
import { deadlineInfo, STATUS_LABEL, TONE_CLASS } from "@/lib/dossier"
import { useTypeMap } from "@/lib/hooks"
import { cn } from "@/lib/utils"
import { formatDateTime } from "@/lib/vn"

const greeting = (): string => {
  const h = new Date().getHours()
  if (h < 11) {
    return "Chào buổi sáng"
  }
  if (h < 14) {
    return "Chào buổi trưa"
  }
  if (h < 18) {
    return "Chào buổi chiều"
  }
  return "Chào buổi tối"
}

interface StatProps {
  label: string
  value: number | undefined
  icon: React.ComponentType<{ className?: string }>
  href: string
  tone?: string
}

const Stat = ({ label, value, icon: Icon, href, tone }: StatProps) => (
  <Link
    className="group bg-card hover:border-primary/40 focus-visible:ring-ring/50 rounded-xl border p-4 shadow-xs transition-colors outline-none focus-visible:ring-[3px]"
    href={href}
  >
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-sm">{label}</span>
      <Icon className={cn("text-muted-foreground size-4", tone)} />
    </div>
    <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value ?? "–"}</p>
  </Link>
)

export const DashboardView = () => {
  const dossiers = useLiveQuery(() => db.dossiers.orderBy("updatedAt").reverse().toArray(), [])
  const templateCount = useLiveQuery(() => db.templates.count(), [])
  const typeCount = useLiveQuery(() => db.dossierTypes.count(), [])
  const types = useTypeMap()

  const drafts = dossiers?.filter((d) => d.status === "draft") ?? []
  const done = dossiers?.filter((d) => d.status === "done").length
  const urgent = drafts
    .map((d) => ({ d, info: deadlineInfo(d) }))
    .filter(({ info }) => info.tone === "overdue" || info.tone === "soon")
  const recent = dossiers?.slice(0, 6) ?? []

  return (
    <div className="space-y-8">
      <PageHeader
        actions={typeCount === 0 ? <SampleDataButton /> : null}
        description="Chọn loại hồ sơ, nhập thông tin một lần, phần mềm tự dựng đủ bộ văn bản theo biểu mẫu."
        title={greeting()}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          href="/ho-so/"
          icon={FilePenLineIcon}
          label="Đang lập"
          tone="text-warning"
          value={dossiers ? drafts.length : undefined}
        />
        <Stat href="/ho-so/" icon={CheckCircle2Icon} label="Hoàn thành" tone="text-success" value={done} />
        <Stat href="/loai-ho-so/" icon={LayersIcon} label="Loại hồ sơ" value={typeCount} />
        <Stat href="/bieu-mau/" icon={FileTextIcon} label="Biểu mẫu" value={templateCount} />
      </div>

      {urgent.length > 0 ? (
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader className="border-warning/30 flex-row items-center gap-2">
            <AlarmClockIcon className="text-warning size-4" />
            <CardTitle>Cần xử lý gấp</CardTitle>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {urgent.map(({ d, info }) => (
              <Link
                className="hover:bg-warning/10 flex items-center justify-between gap-3 px-5 py-3 text-sm"
                href={`/ho-so/lap/?id=${d.id}`}
                key={d.id}
              >
                <span className="truncate font-medium">{d.title}</span>
                <span className={cn("shrink-0 text-xs font-medium", TONE_CLASS[info.tone])}>{info.text}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Lập nhanh</h2>
            <p className="text-muted-foreground text-sm">Bấm vào một loại hồ sơ để bắt đầu.</p>
          </div>
        </div>
        <DossierTypePicker compact />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Hồ sơ gần đây</CardTitle>
              <CardDescription>Các hồ sơ được cập nhật gần nhất</CardDescription>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link href="/ho-so/">
                Xem tất cả <ArrowRightIcon />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {recent.length === 0 ? (
              <p className="text-muted-foreground px-5 py-10 text-center text-sm">Chưa có hồ sơ nào.</p>
            ) : (
              <ul className="divide-y">
                {recent.map((d) => (
                  <li key={d.id}>
                    <Link
                      className="hover:bg-muted/40 flex items-center gap-3 px-5 py-3"
                      href={`/ho-so/lap/?id=${d.id}`}
                    >
                      <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                        <FileTextIcon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{d.title}</span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {types?.get(d.typeId)?.name ?? "—"} · {formatDateTime(d.updatedAt)}
                        </span>
                      </span>
                      <Badge variant={d.status === "done" ? "success" : "warning"}>
                        {STATUS_LABEL[d.status]}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="bg-primary/10 pointer-events-none absolute -top-10 -right-10 size-40 rounded-full blur-2xl" />
          <CardHeader className="border-0 pb-0">
            <ShieldCheckIcon className="text-primary size-6" />
            <CardTitle className="mt-2">Quy trình 3 bước</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4 text-sm">
              {[
                ["Đưa biểu mẫu vào", "Tải file Word đã đánh dấu {ten_truong} ở mục Biểu mẫu."],
                [
                  "Gom thành loại hồ sơ",
                  "Chọn các biểu mẫu tạo nên một bộ hồ sơ, sắp thứ tự, đặt điều kiện.",
                ],
                ["Nhập & tạo hồ sơ", "Điền bảng thông tin một lần, tải trọn bộ .docx hoặc in ngay."],
              ].map(([title, text], i) => (
                <li className="flex gap-3" key={title}>
                  <span className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block font-medium">{title}</span>
                    <span className="text-muted-foreground">{text}</span>
                  </span>
                </li>
              ))}
            </ol>
            <Button asChild className="mt-5 w-full" variant="outline">
              <Link href="/huong-dan/">Xem hướng dẫn chi tiết</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
