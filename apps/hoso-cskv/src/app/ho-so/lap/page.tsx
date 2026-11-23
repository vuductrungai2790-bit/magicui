import type { Metadata } from "next"
import { Suspense } from "react"

import { DossierEditorRoute } from "@/components/views/dossier-editor-route"

export const metadata: Metadata = { title: "Nhập thông tin hồ sơ" }

const Page = () => (
  <Suspense>
    <DossierEditorRoute />
  </Suspense>
)

export default Page
