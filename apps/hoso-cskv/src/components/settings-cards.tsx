"use client"

import { useLiveQuery } from "dexie-react-hooks"
import {
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  PlugZapIcon,
  SaveIcon,
  ScrollTextIcon,
  SparklesIcon,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { useAiSettings } from "@/components/ai-dialogs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input, inputClass } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { AI_MODELS, type AiSettings, saveAiSettings, testConnection } from "@/lib/ai"
import { DEFAULT_FORMAT, db, FORMAT_KEY, type FormatSettings, saveSetting } from "@/lib/db"

const ClaudeForm = ({ initial }: { initial: AiSettings }) => {
  const [form, setForm] = useState(initial)
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState<"save" | "test" | null>(null)

  const save = async (next = form) => {
    setBusy("save")
    try {
      await saveAiSettings(next)
      toast.success("Đã lưu cài đặt Claude")
    } finally {
      setBusy(null)
    }
  }

  const test = async () => {
    setBusy("test")
    try {
      await saveAiSettings(form)
      const reply = await testConnection(form)
      toast.success("Kết nối Claude thành công", { description: `Claude trả lời: “${reply}”` })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không kết nối được")
    } finally {
      setBusy(null)
    }
  }

  return (
    <CardContent className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
        <Label htmlFor="ai-enabled">Bật trợ lý Claude</Label>
        <Switch
          checked={form.enabled}
          id="ai-enabled"
          onCheckedChange={(enabled) => {
            const next = { ...form, enabled }
            setForm(next)
            save(next)
          }}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ai-key">Khóa API (API key)</Label>
        <div className="flex gap-2">
          <Input
            autoComplete="off"
            id="ai-key"
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            placeholder="sk-ant-…"
            spellCheck={false}
            type={show ? "text" : "password"}
            value={form.apiKey}
          />
          <Button
            aria-label={show ? "Ẩn khóa" : "Hiện khóa"}
            onClick={() => setShow((v) => !v)}
            size="icon"
            variant="outline"
          >
            {show ? <EyeOffIcon /> : <EyeIcon />}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Tạo khóa tại{" "}
          <a
            className="text-primary font-medium hover:underline"
            href="https://console.anthropic.com/settings/keys"
            rel="noopener noreferrer"
            target="_blank"
          >
            console.anthropic.com
          </a>
          . Khóa chỉ lưu trên máy này. Chưa có khóa vẫn dùng được qua claude.ai (sao chép – dán).
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ai-model">Mô hình</Label>
        <select
          className={inputClass}
          id="ai-model"
          onChange={(e) => setForm({ ...form, model: e.target.value })}
          value={form.model}
        >
          {AI_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy !== null} onClick={() => save()}>
          {busy === "save" ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
          Lưu
        </Button>
        <Button disabled={busy !== null || !form.apiKey.trim()} onClick={test} variant="outline">
          {busy === "test" ? <Loader2Icon className="animate-spin" /> : <PlugZapIcon />}
          Kiểm tra kết nối
        </Button>
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        Khi dùng Claude, thông tin hồ sơ liên quan được gửi tới Anthropic qua Internet để xử lý. Nội dung
        Claude soạn chỉ là bản nháp – cán bộ kiểm tra trước khi đưa vào hồ sơ.
      </p>
    </CardContent>
  )
}

export const ClaudeSettingsCard = () => {
  const settings = useAiSettings()
  const loaded = useLiveQuery(() => db.settings.get("claude").then((r) => r ?? null), [])
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SparklesIcon className="text-primary size-4" />
          Kết nối Claude
        </CardTitle>
        <CardDescription>
          Soạn nội dung biên bản, báo cáo và tự điền thông tin từ văn bản dán vào.
        </CardDescription>
      </CardHeader>
      {loaded === undefined ? null : <ClaudeForm initial={settings} key={loaded ? "saved" : "new"} />}
    </Card>
  )
}

export const FormatSettingsCard = () => {
  const rec = useLiveQuery(() => db.settings.get(FORMAT_KEY), [])
  const value: FormatSettings = { ...DEFAULT_FORMAT, ...((rec?.value as Partial<FormatSettings>) ?? {}) }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScrollTextIcon className="text-primary size-4" />
          Thể thức văn bản
        </CardTitle>
        <CardDescription>Theo Nghị định 30/2020/NĐ-CP về công tác văn thư.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
          <Label htmlFor="normalize">Tự chuẩn hóa khi xuất file Word</Label>
          <Switch
            checked={value.normalize}
            id="normalize"
            onCheckedChange={(normalize) => saveSetting(FORMAT_KEY, { ...value, normalize })}
          />
        </div>
        <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-xs leading-relaxed">
          <li>Khổ giấy A4 (210 × 297 mm).</li>
          <li>Lề trên, dưới 20–25 mm; lề trái 30–35 mm; lề phải 15–20 mm.</li>
          <li>Phông chữ Times New Roman (Unicode), thay các phông cũ như .VnTime.</li>
          <li>
            Ngày tháng “ngày 05 tháng 3 năm 2026”; số văn bản dưới 10 thêm số 0; số tiền “1.500.000 đồng”.
          </li>
          <li>Cỡ chữ, căn lề, in đậm/nghiêng giữ nguyên theo biểu mẫu.</li>
        </ul>
      </CardContent>
    </Card>
  )
}
