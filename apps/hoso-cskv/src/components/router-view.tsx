"use client"

import { useEffect } from "react"

import { CreateDossierView } from "@/components/views/create-dossier-view"
import { DashboardView } from "@/components/views/dashboard-view"
import { DossierEditorRoute } from "@/components/views/dossier-editor-route"
import { DossierListView } from "@/components/views/dossier-list-view"
import { DossierTypeEditor, DossierTypesView } from "@/components/views/dossier-types-view"
import { FieldsView } from "@/components/views/fields-view"
import { GuideView } from "@/components/views/guide-view"
import { SettingsView } from "@/components/views/settings-view"
import { TemplatesView } from "@/components/views/templates-view"
import { usePathname } from "@/lib/router"

const ROUTES: Record<string, { title: string; view: () => React.ReactNode }> = {
  "/": { title: "Tổng quan", view: DashboardView },
  "/ho-so/": { title: "Hồ sơ đã lập", view: DossierListView },
  "/ho-so/moi/": { title: "Lập hồ sơ mới", view: CreateDossierView },
  "/ho-so/lap/": { title: "Nhập thông tin hồ sơ", view: DossierEditorRoute },
  "/loai-ho-so/": { title: "Loại hồ sơ", view: DossierTypesView },
  "/loai-ho-so/sua/": { title: "Cấu hình loại hồ sơ", view: DossierTypeEditor },
  "/bieu-mau/": { title: "Biểu mẫu", view: TemplatesView },
  "/truong/": { title: "Từ điển trường", view: FieldsView },
  "/cai-dat/": { title: "Cài đặt", view: SettingsView },
  "/huong-dan/": { title: "Hướng dẫn", view: GuideView },
}

const HOME = { title: "Tổng quan", view: DashboardView }

/** Hiển thị trang tương ứng với địa chỉ sau dấu # */
export const RouterView = () => {
  const path = usePathname()
  const route = ROUTES[path] ?? HOME

  useEffect(() => {
    document.title = `${route.title} · Hồ sơ CSKV`
    window.scrollTo(0, 0)
  }, [route])

  const View = route.view
  return <View key={path} />
}
