import type { Metadata } from "next"

import { DossierTypesView } from "@/components/views/dossier-types-view"

export const metadata: Metadata = { title: "Loại hồ sơ" }

const Page = () => <DossierTypesView />

export default Page
