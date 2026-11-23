"use client"

import { DatabaseBackupIcon, Loader2Icon, SaveIcon, Trash2Icon, UploadIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import { SampleDataButton } from "@/components/sample-data-button"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Confirm } from "@/components/ui/confirm"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { exportBackup, importBackup, wipeAll } from "@/lib/backup"
import { getUnitDefaults, saveUnitDefaults } from "@/lib/db"
import { downloadBlob } from "@/lib/docx"
import { UNIT_GROUP } from "@/lib/fields"
import { useFieldMap } from "@/lib/hooks"
import { todayIso } from "@/lib/vn"

export const SettingsView = () => {
  const dictionary = useFieldMap()
  const [values, setValues] = useState<Record<string, string> | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const restoreRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getUnitDefaults().then(setValues)
  }, [])

  const unitFields = useMemo(
    () =>
      [...(dictionary?.values() ?? [])]
        .filter((f) => f.group === UNIT_GROUP && f.type !== "table")
        .sort((a, b) => a.order - b.order),
    [dictionary]
  )

  const saveUnit = async () => {
    if (!values) {
      return
    }
    await saveUnitDefaults(values)
    toast.success("Đã lưu thông tin đơn vị", { description: "Áp dụng cho các hồ sơ lập mới từ bây giờ." })
  }

  const backup = async () => {
    setBusy("backup")
    try {
      downloadBlob(await exportBackup(), `hoso-cskv-saoluu-${todayIso()}.json`)
    } finally {
      setBusy(null)
    }
  }

  const restore = async (file: File | undefined) => {
    if (restoreRef.current) {
      restoreRef.current.value = ""
    }
    if (!file) {
      return
    }
    setBusy("restore")
    try {
      await importBackup(file)
      setValues(await getUnitDefaults())
      toast.success("Đã khôi phục dữ liệu")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Khôi phục thất bại")
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader
        description="Thông tin đơn vị dùng để điền sẵn, sao lưu và quản lý dữ liệu."
        title="Cài đặt"
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Đơn vị & cán bộ</CardTitle>
            <CardDescription>
              Được điền sẵn vào mọi hồ sơ lập mới (vẫn sửa được trong từng hồ sơ).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault()
                saveUnit()
              }}
            >
              {unitFields.map((f) => (
                <div className="space-y-1.5" key={f.code}>
                  <Label htmlFor={`unit-${f.code}`}>{f.label}</Label>
                  <Input
                    id={`unit-${f.code}`}
                    onChange={(e) => setValues((v) => ({ ...(v ?? {}), [f.code]: e.target.value }))}
                    placeholder={f.hint}
                    value={values?.[f.code] ?? ""}
                  />
                </div>
              ))}
              <div className="sm:col-span-2">
                <Button disabled={!values} type="submit">
                  <SaveIcon />
                  Lưu thông tin đơn vị
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sao lưu & khôi phục</CardTitle>
              <CardDescription>
                Dữ liệu nằm trong trình duyệt của máy này. Nên sao lưu định kỳ và cất file ở nơi an toàn.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button disabled={busy !== null} onClick={backup} variant="outline">
                {busy === "backup" ? <Loader2Icon className="animate-spin" /> : <DatabaseBackupIcon />}
                Tải file sao lưu (.json)
              </Button>
              <Confirm
                confirmLabel="Chọn file và khôi phục"
                description="Toàn bộ dữ liệu hiện có trên máy này sẽ bị thay thế bằng dữ liệu trong file sao lưu."
                onConfirm={() => restoreRef.current?.click()}
                title="Khôi phục từ file sao lưu?"
                trigger={(open) => (
                  <Button disabled={busy !== null} onClick={open} variant="outline">
                    {busy === "restore" ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
                    Khôi phục từ file
                  </Button>
                )}
              />
              <input
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => restore(e.target.files?.[0])}
                ref={restoreRef}
                type="file"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dữ liệu minh họa</CardTitle>
              <CardDescription>6 biểu mẫu và 2 loại hồ sơ mẫu để dùng thử.</CardDescription>
            </CardHeader>
            <CardContent>
              <SampleDataButton variant="outline" />
            </CardContent>
          </Card>

          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-destructive">Xóa toàn bộ dữ liệu</CardTitle>
              <CardDescription>Xóa mọi biểu mẫu, loại hồ sơ, hồ sơ và cài đặt trên máy này.</CardDescription>
            </CardHeader>
            <CardContent>
              <Confirm
                confirmLabel="Xóa toàn bộ"
                description="Thao tác không thể hoàn tác. Hãy chắc chắn bạn đã có file sao lưu."
                onConfirm={async () => {
                  await wipeAll()
                  setValues({})
                  toast.success("Đã xóa toàn bộ dữ liệu")
                }}
                title="Xóa toàn bộ dữ liệu?"
                trigger={(open) => (
                  <Button onClick={open} variant="destructive">
                    <Trash2Icon />
                    Xóa toàn bộ
                  </Button>
                )}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
