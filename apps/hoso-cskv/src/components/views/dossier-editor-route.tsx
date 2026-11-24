"use client"

import { useSearchParams } from "@/lib/router"

import { DossierEditor } from "@/components/dossier-editor"

export const DossierEditorRoute = () => {
  const id = useSearchParams().get("id") ?? ""
  return <DossierEditor id={id} key={id} />
}
