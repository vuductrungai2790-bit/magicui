import type { Metadata } from "next"

import { CreateDossierView } from "@/components/views/create-dossier-view"

export const metadata: Metadata = { title: "Lập hồ sơ mới" }

const Page = () => <CreateDossierView />

export default Page
