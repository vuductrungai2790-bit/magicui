"use client"

import { useLiveQuery } from "dexie-react-hooks"
import {
  CopyIcon,
  FilePlus2Icon,
  FolderOpenIcon,
  MoreHorizontalIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { EmptyState, PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Confirm } from "@/components/ui/confirm"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { db } from "@/lib/db"
import { deadlineInfo, duplicateDossier, STATUS_LABEL, TONE_CLASS } from "@/lib/dossier"
import { useTypeMap } from "@/lib/hooks"
import type { Dossier } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatDateTime, removeDiacritics } from "@/lib/vn"
import { Link, useRouter } from "@/lib/router"

const ALL = "all"

const norm = (s: string) => removeDiacritics(s).toLowerCase()

const searchable = (d: Dossier): string =>
  norm([d.title, ...Object.values(d.data).filter((v): v is string => typeof v === "string")].join(" "))

const RowActions = ({ dossier }: { dossier: Dossier }) => {
  const router = useRouter()
  const duplicate = async () => {
    const id = await duplicateDossier(dossier.id)
    toast.success("Đã nhân bản hồ sơ")
    router.push(`/ho-so/lap/?id=${id}`)
  }
  return (
    <Confirm
      description={`Hồ sơ “${dossier.title}” sẽ bị xóa vĩnh viễn khỏi máy này.`}
      onConfirm={async () => {
        await db.dossiers.delete(dossier.id)
        toast.success("Đã xóa hồ sơ")
      }}
      title="Xóa hồ sơ?"
      trigger={(open) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label="Thao tác" size="icon-sm" variant="ghost">
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/ho-so/lap/?id=${dossier.id}`}>
                <FolderOpenIcon />
                Mở
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={duplicate}>
              <CopyIcon />
              Nhân bản
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={open} variant="destructive">
              <Trash2Icon />
              Xóa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    />
  )
}

export const DossierListView = () => {
  const dossiers = useLiveQuery(() => db.dossiers.orderBy("updatedAt").reverse().toArray(), [])
  const types = useTypeMap()
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState(ALL)
  const [statusFilter, setStatusFilter] = useState(ALL)

  const filtered = useMemo(() => {
    const q = norm(query.trim())
    return (dossiers ?? []).filter(
      (d) =>
        (typeFilter === ALL || d.typeId === typeFilter) &&
        (statusFilter === ALL || d.status === statusFilter) &&
        (!q || searchable(d).includes(q))
    )
  }, [dossiers, query, typeFilter, statusFilter])

  return (
    <>
      <PageHeader
        actions={
          <Button asChild>
            <Link href="/ho-so/moi/">
              <FilePlus2Icon />
              Lập hồ sơ mới
            </Link>
          </Button>
        }
        description="Tất cả hồ sơ đã lập trên máy này. Tìm theo tiêu đề, họ tên, địa chỉ hoặc bất kỳ thông tin nào đã nhập."
        title="Hồ sơ đã lập"
      />

      {dossiers && dossiers.length === 0 ? (
        <EmptyState
          action={
            <Button asChild>
              <Link href="/ho-so/moi/">Lập hồ sơ đầu tiên</Link>
            </Button>
          }
          description="Hồ sơ bạn lập sẽ được lưu tại đây để mở lại, chỉnh sửa hoặc nhân bản."
          icon={FolderOpenIcon}
          title="Chưa có hồ sơ"
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-2 border-b p-3 sm:flex-row">
            <div className="relative flex-1">
              <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                aria-label="Tìm kiếm hồ sơ"
                className="pl-9"
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm kiếm… (gõ không dấu cũng được)"
                value={query}
              />
            </div>
            <Select onValueChange={setTypeFilter} value={typeFilter}>
              <SelectTrigger aria-label="Lọc theo loại hồ sơ" className="sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tất cả loại hồ sơ</SelectItem>
                {[...(types?.values() ?? [])].map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={setStatusFilter} value={statusFilter}>
              <SelectTrigger aria-label="Lọc theo trạng thái" className="sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Mọi trạng thái</SelectItem>
                <SelectItem value="draft">{STATUS_LABEL.draft}</SelectItem>
                <SelectItem value="done">{STATUS_LABEL.done}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
                <tr>
                  <th className="px-4 py-2.5 font-medium" scope="col">
                    Hồ sơ
                  </th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell" scope="col">
                    Trạng thái
                  </th>
                  <th className="hidden px-4 py-2.5 font-medium sm:table-cell" scope="col">
                    Hạn
                  </th>
                  <th className="hidden px-4 py-2.5 font-medium lg:table-cell" scope="col">
                    Cập nhật
                  </th>
                  <th className="w-12 px-2" scope="col">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const deadline = deadlineInfo(d)
                  return (
                    <tr className="hover:bg-muted/40 border-t transition-colors" key={d.id}>
                      <td className="max-w-0 px-4 py-3">
                        <Link
                          className="hover:text-primary block truncate font-medium"
                          href={`/ho-so/lap/?id=${d.id}`}
                        >
                          {d.title}
                        </Link>
                        <p className="text-muted-foreground truncate text-xs">
                          {types?.get(d.typeId)?.name ?? "Loại hồ sơ đã xóa"}
                        </p>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <Badge variant={d.status === "done" ? "success" : "warning"}>
                          {STATUS_LABEL[d.status]}
                        </Badge>
                      </td>
                      <td
                        className={cn(
                          "hidden px-4 py-3 text-xs whitespace-nowrap sm:table-cell",
                          TONE_CLASS[deadline.tone]
                        )}
                      >
                        {deadline.text || "—"}
                      </td>
                      <td className="text-muted-foreground hidden px-4 py-3 text-xs whitespace-nowrap lg:table-cell">
                        {formatDateTime(d.updatedAt)}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <RowActions dossier={d} />
                      </td>
                    </tr>
                  )
                })}
                {dossiers && filtered.length === 0 ? (
                  <tr>
                    <td className="text-muted-foreground px-4 py-10 text-center" colSpan={5}>
                      Không có hồ sơ phù hợp.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  )
}
