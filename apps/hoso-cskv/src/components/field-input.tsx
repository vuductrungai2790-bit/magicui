"use client"

import { PlusIcon, Trash2Icon } from "lucide-react"
import { useId } from "react"

import { Button } from "@/components/ui/button"
import { Input, Textarea } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { newId } from "@/lib/db"
import type { ColumnDef, FieldDef, FieldValue, TableRow } from "@/lib/types"
import { cn } from "@/lib/utils"
import { dateToWords, moneyToWords, numberToWords, parseNumber, timeToWords } from "@/lib/vn"

const CLEAR = "__clear__"

/** Dòng gợi ý hiển thị cách giá trị sẽ được in ra văn bản. */
const previewText = (type: FieldDef["type"], value: string): string => {
  if (!value) {
    return ""
  }
  if (type === "date") {
    return dateToWords(value)
  }
  if (type === "time") {
    return timeToWords(value)
  }
  if (type === "money" || type === "number") {
    const n = parseNumber(value)
    if (n === null) {
      return ""
    }
    return type === "money" ? moneyToWords(n) : numberToWords(n)
  }
  return ""
}

interface ScalarProps {
  id: string
  type: ColumnDef["type"] | "textarea"
  value: string
  onChange: (v: string) => void
  options?: string[]
  invalid?: boolean
  placeholder?: string
  compact?: boolean
  ariaLabel?: string
}

const ScalarInput = ({
  id,
  type,
  value,
  onChange,
  options,
  invalid,
  placeholder,
  compact,
  ariaLabel,
}: ScalarProps) => {
  const common = {
    id,
    "aria-invalid": invalid || undefined,
    "aria-label": ariaLabel,
    className: compact ? "h-8" : undefined,
  }
  switch (type) {
    case "textarea":
      return (
        <Textarea
          {...common}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          value={value}
        />
      )
    case "date":
      return <Input {...common} onChange={(e) => onChange(e.target.value)} type="date" value={value} />
    case "time":
      return <Input {...common} onChange={(e) => onChange(e.target.value)} type="time" value={value} />
    case "number":
    case "money":
    case "cccd":
    case "phone":
      return (
        <Input
          {...common}
          inputMode="numeric"
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? (type === "cccd" ? "12 chữ số" : undefined)}
          value={value}
        />
      )
    case "select":
      if (options && options.length > 0) {
        return (
          <Select onValueChange={(v) => onChange(v === CLEAR ? "" : v)} value={value || undefined}>
            <SelectTrigger
              aria-invalid={invalid || undefined}
              aria-label={ariaLabel}
              className={cn(compact && "h-8")}
              id={id}
            >
              <SelectValue placeholder="Chọn…" />
            </SelectTrigger>
            <SelectContent>
              {value ? (
                <SelectItem className="text-muted-foreground" value={CLEAR}>
                  — Bỏ chọn —
                </SelectItem>
              ) : null}
              {options.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      }
      return <Input {...common} onChange={(e) => onChange(e.target.value)} value={value} />
    default:
      return (
        <Input
          {...common}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          value={value}
        />
      )
  }
}

interface TableInputProps {
  def: FieldDef
  rows: TableRow[]
  onChange: (rows: TableRow[]) => void
}

const TableInput = ({ def, rows, onChange }: TableInputProps) => {
  const baseId = useId()
  const columns = def.columns ?? []
  const update = (rowId: string, col: string, v: string) =>
    onChange(rows.map((r) => (r._id === rowId ? { ...r, [col]: v } : r)))
  const add = () => onChange([...rows, { _id: newId() } as TableRow])
  const remove = (rowId: string) => onChange(rows.filter((r) => r._id !== rowId))

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-muted/60 text-muted-foreground text-xs">
            <tr>
              <th className="w-10 px-2 py-2 text-center font-medium" scope="col">
                STT
              </th>
              {columns.map((c) => (
                <th className="px-2 py-2 text-left font-medium" key={c.code} scope="col">
                  {c.label}
                </th>
              ))}
              <th className="w-10" scope="col">
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="text-muted-foreground px-3 py-6 text-center" colSpan={columns.length + 2}>
                  Chưa có dòng nào.
                </td>
              </tr>
            ) : null}
            {rows.map((row, i) => (
              <tr className="border-t" key={row._id}>
                <td className="text-muted-foreground px-2 py-1.5 text-center tabular-nums">{i + 1}</td>
                {columns.map((c) => (
                  <td className="px-1 py-1.5" key={c.code}>
                    <ScalarInput
                      ariaLabel={`${c.label} – dòng ${i + 1}`}
                      compact
                      id={`${baseId}-${row._id}-${c.code}`}
                      onChange={(v) => update(row._id, c.code, v)}
                      type={c.type}
                      value={row[c.code] ?? ""}
                    />
                  </td>
                ))}
                <td className="px-1 py-1.5 text-center">
                  <Button
                    aria-label={`Xóa dòng ${i + 1}`}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => remove(row._id)}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <Trash2Icon />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-muted/30 border-t p-2">
        <Button onClick={add} size="sm" variant="ghost">
          <PlusIcon />
          Thêm dòng
        </Button>
      </div>
    </div>
  )
}

interface FieldInputProps {
  def: FieldDef
  value: FieldValue | undefined
  onChange: (value: FieldValue) => void
  error?: string | null
}

export const FieldInput = ({ def, value, onChange, error }: FieldInputProps) => {
  const id = useId()
  const errorId = `${id}-error`

  if (def.type === "boolean") {
    return (
      <div className="bg-muted/30 flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5 sm:col-span-2">
        <Label className="leading-snug" htmlFor={id}>
          {def.label}
        </Label>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <span aria-hidden="true">{value === true ? "Có" : "Không"}</span>
          <Switch checked={value === true} id={id} onCheckedChange={(v) => onChange(v)} />
        </div>
      </div>
    )
  }

  if (def.type === "table") {
    return (
      <div className="space-y-2 sm:col-span-2">
        <p className="text-sm font-medium">{def.label}</p>
        <TableInput def={def} onChange={onChange} rows={Array.isArray(value) ? value : []} />
      </div>
    )
  }

  const str = typeof value === "string" ? value : ""
  const hint = previewText(def.type, str)
  const wide = def.type === "textarea"

  return (
    <div className={cn("flex flex-col gap-1.5", wide && "sm:col-span-2")}>
      <Label htmlFor={id}>
        {def.label}
        {def.required ? (
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        ) : null}
      </Label>
      <ScalarInput
        id={id}
        invalid={Boolean(error)}
        onChange={onChange}
        options={def.options}
        placeholder={def.hint}
        type={def.type}
        value={str}
      />
      {error ? (
        <p className="text-destructive text-xs" id={errorId}>
          {error}
        </p>
      ) : null}
      {!error && hint ? <p className="text-muted-foreground text-xs">→ {hint}</p> : null}
    </div>
  )
}
