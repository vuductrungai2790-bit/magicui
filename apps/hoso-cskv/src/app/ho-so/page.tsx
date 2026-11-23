import type { Metadata } from "next"

import { DossierListView } from "@/components/views/dossier-list-view"

export const metadata: Metadata = { title: "Hồ sơ đã lập" }

const Page = () => <DossierListView />

export default Page
