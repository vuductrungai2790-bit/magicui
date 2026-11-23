import type { Metadata } from "next"

import { SettingsView } from "@/components/views/settings-view"

export const metadata: Metadata = { title: "Cài đặt" }

const Page = () => <SettingsView />

export default Page
