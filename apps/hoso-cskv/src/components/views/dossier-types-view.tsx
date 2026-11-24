"use client"

import { useLiveQuery } from "dexie-react-hooks"
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  FilePlus2Icon,
  FileTextIcon,
  LayersIcon,
  PencilIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { EmptyState, PageHeader } from "@/components/page-header"
import { SampleDataButton } from "@/components/sample-data-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Confirm } from "@/components/ui/confirm"
import { Input, Textarea } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { db, newId } from "@/lib/db"
import { CATEGORIES, collectFields } from "@/lib/dossier"
import { useFieldMap, useTemplateMap } from "@/lib/hooks"
import type { DossierComponent, DossierType } from "@/lib/types"
import { Link, useRouter, useSearchParams } from "@/lib/router"

const ALWAYS = "__always__"

/* ------------------------------ Danh sách ------------------------------ */

export const DossierTypesView = () => {
  const types = useLiveQuery(() => db.dossierTypes.orderBy("name").toArray(), [])
  const templates = useTemplateMap()
  const counts = useLiveQuery(async () => {
    const all = await db.dossiers.toArray()
    const map = new Map<string, number>()
    for (const d of all) {
      map.set(d.typeId, (map.get(d.typeId) ?? 0) + 1)
    }
    return map
  }, [])

  return (
    <>
      <PageHeader
        actions={
          <Button asChild>
            <Link href="/loai-ho-so/sua/?id=moi">
              <PlusIcon />
              Tạo loại hồ sơ
            </Link>
          </Button>
        }
        description="Mỗi loại hồ sơ là một bộ gồm nhiều biểu mẫu theo thứ tự. Có thể đặt điều kiện để một văn bản chỉ được tạo khi cần."
        title="Loại hồ sơ"
      />
      {types && types.length === 0 ? (
        <EmptyState
          action={
            <>
              <Button asChild>
                <Link href="/loai-ho-so/sua/?id=moi">Tạo loại hồ sơ</Link>
              </Button>
              <SampleDataButton variant="outline" />
            </>
          }
          description="Hãy thêm biểu mẫu trước, sau đó gom chúng thành loại hồ sơ."
          icon={LayersIcon}
          title="Chưa có loại hồ sơ"
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {types?.map((t) => (
            <Card className="flex flex-col p-0" key={t.id}>
              <div className="flex items-start gap-3 p-4">
                <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                  <LayersIcon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="leading-snug font-semibold">{t.name}</p>
                  <p className="text-muted-foreground text-xs">{t.category}</p>
                  {t.description ? (
                    <p className="text-muted-foreground mt-1 text-sm">{t.description}</p>
                  ) : null}
                </div>
              </div>
              <ol className="border-primary/20 mx-4 space-y-1 border-l-2 pl-4 text-sm">
                {t.components.map((c, i) => (
                  <li className="flex items-center gap-2" key={`${c.templateId}-${i}`}>
                    <span className="text-muted-foreground text-xs tabular-nums">{i + 1}.</span>
                    <span className="truncate">{templates?.get(c.templateId)?.name ?? "(đã xóa)"}</span>
                    {c.conditionField ? (
                      <Badge className="ml-auto" variant="secondary">
                        có điều kiện
                      </Badge>
                    ) : null}
                  </li>
                ))}
                {t.components.length === 0 ? (
                  <li className="text-muted-foreground">Chưa có thành phần</li>
                ) : null}
              </ol>
              <div className="mt-4 flex items-center justify-between gap-2 border-t px-4 py-3">
                <span className="text-muted-foreground text-xs">
                  {counts?.get(t.id) ?? 0} hồ sơ đã lập
                  {t.deadlineDays > 0 ? ` · nhắc hạn ${t.deadlineDays} ngày` : ""}
                </span>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/loai-ho-so/sua/?id=${t.id}`}>
                    <PencilIcon />
                    Sửa
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

/* ------------------------------ Biên tập ------------------------------ */

const blankType = (): DossierType => ({
  id: newId(),
  name: "",
  description: "",
  category: CATEGORIES[0],
  components: [],
  deadlineDays: 0,
  createdAt: Date.now(),
  updatedAt: Date.now(),
})

export const DossierTypeEditor = () => {
  const router = useRouter()
  const idParam = useSearchParams().get("id") ?? "moi"
  const isNew = idParam === "moi"
  const templates = useTemplateMap()
  const dictionary = useFieldMap()
  const [draft, setDraft] = useState<DossierType | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (isNew) {
        setDraft(blankType())
        return
      }
      const t = await db.dossierTypes.get(idParam)
      if (!cancelled) {
        setDraft(t ?? null)
        setMissing(!t)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [idParam, isNew])

  const booleanFields = useMemo(
    () => [...(dictionary?.values() ?? [])].filter((f) => f.type === "boolean"),
    [dictionary]
  )

  const mergedFields = useMemo(
    () => (draft && templates && dictionary ? collectFields(draft, templates, dictionary, null) : []),
    [draft, templates, dictionary]
  )

  if (missing) {
    return (
      <EmptyState
        action={
          <Button asChild>
            <Link href="/loai-ho-so/">Về danh sách</Link>
          </Button>
        }
        description="Loại hồ sơ này không tồn tại hoặc đã bị xóa."
        icon={LayersIcon}
        title="Không tìm thấy"
      />
    )
  }
  if (!(draft && templates)) {
    return null
  }

  const set = (p: Partial<DossierType>) => setDraft({ ...draft, ...p })
  const setComponent = (i: number, p: Partial<DossierComponent>) =>
    set({ components: draft.components.map((c, j) => (j === i ? { ...c, ...p } : c)) })
  const move = (i: number, dir: -1 | 1) => {
    const list = [...draft.components]
    const j = i + dir
    const a = list[i]
    const b = list[j]
    if (!(a && b)) {
      return
    }
    list[i] = b
    list[j] = a
    set({ components: list })
  }
  const remove = (i: number) => set({ components: draft.components.filter((_, j) => j !== i) })
  const add = (templateId: string) => set({ components: [...draft.components, { templateId }] })

  const save = async () => {
    if (!draft.name.trim()) {
      toast.error("Hãy nhập tên loại hồ sơ")
      return
    }
    await db.dossierTypes.put({ ...draft, name: draft.name.trim(), updatedAt: Date.now() })
    toast.success("Đã lưu loại hồ sơ")
    router.push("/loai-ho-so/")
  }

  const del = async () => {
    const used = await db.dossiers.where("typeId").equals(draft.id).count()
    if (used > 0) {
      toast.error(`Không thể xóa: đang có ${used} hồ sơ thuộc loại này.`)
      return
    }
    await db.dossierTypes.delete(draft.id)
    toast.success("Đã xóa loại hồ sơ")
    router.push("/loai-ho-so/")
  }

  const allTemplates = [...templates.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"))

  return (
    <div className="space-y-6">
      <Link
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
        href="/loai-ho-so/"
      >
        <ArrowLeftIcon className="size-4" />
        Loại hồ sơ
      </Link>
      <PageHeader
        actions={
          <>
            {isNew ? null : (
              <Confirm
                description="Loại hồ sơ sẽ bị xóa. Biểu mẫu vẫn được giữ lại."
                onConfirm={del}
                title="Xóa loại hồ sơ?"
                trigger={(open) => (
                  <Button onClick={open} variant="outline">
                    <Trash2Icon />
                    Xóa
                  </Button>
                )}
              />
            )}
            <Button onClick={save}>
              <SaveIcon />
              Lưu
            </Button>
          </>
        }
        className="mb-0"
        title={isNew ? "Tạo loại hồ sơ" : draft.name || "Sửa loại hồ sơ"}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Thông tin chung</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ten-loai">
                  Tên loại hồ sơ <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ten-loai"
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder="Ví dụ: Hồ sơ xử phạt vi phạm hành chính"
                  value={draft.name}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nhom-loai">Nhóm nghiệp vụ</Label>
                <Select onValueChange={(v) => set({ category: v })} value={draft.category}>
                  <SelectTrigger id="nhom-loai">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="han-loai">Nhắc hạn sau (ngày)</Label>
                <Input
                  id="han-loai"
                  inputMode="numeric"
                  min={0}
                  onChange={(e) => set({ deadlineDays: Math.max(0, Number(e.target.value) || 0) })}
                  type="number"
                  value={draft.deadlineDays}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="mo-ta-loai">Mô tả</Label>
                <Textarea
                  id="mo-ta-loai"
                  onChange={(e) => set({ description: e.target.value })}
                  rows={2}
                  value={draft.description}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Thành phần hồ sơ</CardTitle>
              <CardDescription>Thứ tự ở đây cũng là thứ tự đánh số file khi tạo bộ hồ sơ.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {draft.components.map((c, i) => {
                const t = templates.get(c.templateId)
                return (
                  <div
                    className="bg-muted/30 flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"
                    key={`${c.templateId}-${i}`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{t?.name ?? "(Biểu mẫu đã xóa)"}</p>
                        <p className="text-muted-foreground text-xs">
                          {t ? `${t.fieldCodes.length} trường` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={(v) =>
                          setComponent(i, { conditionField: v === ALWAYS ? undefined : v })
                        }
                        value={c.conditionField ?? ALWAYS}
                      >
                        <SelectTrigger aria-label="Điều kiện tạo văn bản" className="h-8 w-full sm:w-56">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALWAYS}>Luôn tạo</SelectItem>
                          {booleanFields.map((f) => (
                            <SelectItem key={f.code} value={f.code}>
                              Chỉ khi: {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        aria-label="Lên"
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <ArrowUpIcon />
                      </Button>
                      <Button
                        aria-label="Xuống"
                        disabled={i === draft.components.length - 1}
                        onClick={() => move(i, 1)}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <ArrowDownIcon />
                      </Button>
                      <Button
                        aria-label="Bỏ khỏi bộ hồ sơ"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => remove(i)}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </div>
                )
              })}

              {allTemplates.length === 0 ? (
                <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                  Chưa có biểu mẫu nào.{" "}
                  <Link className="text-primary font-medium hover:underline" href="/bieu-mau/">
                    Thêm biểu mẫu
                  </Link>
                </div>
              ) : (
                <Select onValueChange={add} value="">
                  <SelectTrigger className="border-dashed">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <FilePlus2Icon className="size-4" />
                      Thêm biểu mẫu vào bộ hồ sơ…
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {allTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Bảng nhập liệu gộp</CardTitle>
              <CardDescription>
                {mergedFields.length} trường – mỗi trường chỉ nhập một lần cho cả bộ hồ sơ.
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-[60vh] space-y-1 overflow-auto p-3">
              {mergedFields.length === 0 ? (
                <p className="text-muted-foreground flex items-center gap-2 p-2 text-sm">
                  <FileTextIcon className="size-4" />
                  Thêm biểu mẫu để xem danh sách trường.
                </p>
              ) : null}
              {mergedFields.map((f) => (
                <div
                  className="hover:bg-muted/50 flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm"
                  key={f.code}
                >
                  <span className="truncate">{f.label}</span>
                  <span className="text-muted-foreground shrink-0 font-mono text-[11px]">{f.code}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
