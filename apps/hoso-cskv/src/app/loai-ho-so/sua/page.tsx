import type { Metadata } from "next"
import { Suspense } from "react"

import { DossierTypeEditor } from "@/components/views/dossier-types-view"

export const metadata: Metadata = { title: "Cấu hình loại hồ sơ" }

const Page = () => (
  <Suspense>
    <DossierTypeEditor />
  </Suspense>
)

export default Page
