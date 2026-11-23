"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { useMemo } from "react"

import { db } from "./db"
import type { DossierType, FieldDef, TemplateRecord } from "./types"

export const useFieldMap = (): Map<string, FieldDef> | undefined => {
  const fields = useLiveQuery(() => db.fields.toArray(), [])
  return useMemo(() => (fields ? new Map(fields.map((f) => [f.code, f])) : undefined), [fields])
}

export const useTemplateMap = (): Map<string, TemplateRecord> | undefined => {
  const templates = useLiveQuery(() => db.templates.toArray(), [])
  return useMemo(() => (templates ? new Map(templates.map((t) => [t.id, t])) : undefined), [templates])
}

export const useTypeMap = (): Map<string, DossierType> | undefined => {
  const types = useLiveQuery(() => db.dossierTypes.toArray(), [])
  return useMemo(() => (types ? new Map(types.map((t) => [t.id, t])) : undefined), [types])
}
