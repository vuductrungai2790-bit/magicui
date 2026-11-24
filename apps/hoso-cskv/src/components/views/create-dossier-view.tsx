"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { ArrowRightIcon, FileTextIcon, LayersIcon, Loader2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { EmptyState, PageHeader } from "@/components/page-header"
import { SampleDataButton } from "@/components/sample-data-button"
import { Button } from "@/components/ui/button"
import { db } from "@/lib/db"
import { CATEGORIES, createDossier } from "@/lib/dossier"
import type { DossierType } from "@/lib/types"
import { Link, useRouter } from "@/lib/router"

const byCategory = (types: DossierType[]): [string, DossierType[]][] => {
  const map = new Map<string, DossierType[]>()
  for (const t of types) {
    const list = map.get(t.category) ?? []
    list.push(t)
    map.set(t.category, list)
  }
  const order = (c: string) => {
    const i = (CATEGORIES as readonly string[]).indexOf(c)
    return i === -1 ? 99 : i
  }
  return [...map.entries()].sort((a, b) => order(a[0]) - order(b[0]))
}

export const DossierTypePicker = ({ compact = false }: { compact?: boolean }) => {
  const router = useRouter()
  const types = useLiveQuery(() => db.dossierTypes.orderBy("name").toArray(), [])
  const [creating, setCreating] = useState<string | null>(null)

  const create = async (typeId: string) => {
    setCreating(typeId)
    try {
      const id = await createDossier(typeId)
      router.push(`/ho-so/lap/?id=${id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tạo được hồ sơ")
      setCreating(null)
    }
  }

  if (!types) {
    return null
  }

  if (types.length === 0) {
    return (
      <EmptyState
        action={
          <>
            <SampleDataButton />
            <Button asChild variant="outline">
              <Link href="/loai-ho-so/sua/?id=moi">Tạo loại hồ sơ</Link>
            </Button>
          </>
        }
        description="Hãy tải biểu mẫu Word lên và gom chúng thành một loại hồ sơ, hoặc nạp bộ dữ liệu minh họa để dùng thử."
        icon={LayersIcon}
        title="Chưa có loại hồ sơ nào"
      />
    )
  }

  return (
    <div className="space-y-6">
      {(compact ? [["", types] as [string, DossierType[]]] : byCategory(types)).map(([category, list]) => (
        <section className="space-y-3" key={category || "all"}>
          {compact ? null : <h2 className="text-muted-foreground text-sm font-semibold">{category}</h2>}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((t) => (
              <button
                className="group bg-card hover:border-primary/40 focus-visible:ring-ring/50 flex flex-col gap-3 rounded-xl border p-4 text-left shadow-xs transition-all outline-none hover:-translate-y-px hover:shadow-md focus-visible:ring-[3px] disabled:opacity-60"
                disabled={creating !== null}
                key={t.id}
                onClick={() => create(t.id)}
                type="button"
              >
                <div className="flex items-start gap-3">
                  <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                    {creating === t.id ? (
                      <Loader2Icon className="size-5 animate-spin" />
                    ) : (
                      <FileTextIcon className="size-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="leading-snug font-semibold">{t.name}</p>
                    {t.description ? (
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{t.description}</p>
                    ) : null}
                  </div>
                </div>
                <div className="text-muted-foreground mt-auto flex items-center justify-between text-xs">
                  <span>{t.components.length} thành phần</span>
                  <span className="text-primary inline-flex items-center gap-1 font-medium opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    Lập hồ sơ <ArrowRightIcon className="size-3.5" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export const CreateDossierView = () => (
  <>
    <PageHeader
      description="Chọn loại hồ sơ cần lập. Phần mềm sẽ gộp các thông tin của tất cả văn bản thành một bảng nhập duy nhất."
      title="Lập hồ sơ mới"
    />
    <DossierTypePicker />
  </>
)
