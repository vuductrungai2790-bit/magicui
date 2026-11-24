"use client"

import {
  BookOpenIcon,
  FilePlus2Icon,
  FileTextIcon,
  FolderOpenIcon,
  LayersIcon,
  LayoutDashboardIcon,
  ListTreeIcon,
  LockIcon,
  MenuIcon,
  SettingsIcon,
  XIcon,
} from "lucide-react"
import { useState } from "react"

import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Link, usePathname } from "@/lib/router"

const NAV = [
  {
    title: "Nghiệp vụ",
    items: [
      { href: "/", label: "Tổng quan", icon: LayoutDashboardIcon },
      { href: "/ho-so/moi/", label: "Lập hồ sơ mới", icon: FilePlus2Icon },
      { href: "/ho-so/", label: "Hồ sơ đã lập", icon: FolderOpenIcon },
    ],
  },
  {
    title: "Cấu hình",
    items: [
      { href: "/loai-ho-so/", label: "Loại hồ sơ", icon: LayersIcon },
      { href: "/bieu-mau/", label: "Biểu mẫu", icon: FileTextIcon },
      { href: "/truong/", label: "Từ điển trường", icon: ListTreeIcon },
      { href: "/cai-dat/", label: "Cài đặt", icon: SettingsIcon },
      { href: "/huong-dan/", label: "Hướng dẫn", icon: BookOpenIcon },
    ],
  },
] as const

const normalize = (p: string) => (p.endsWith("/") ? p : `${p}/`)

const isActive = (pathname: string, href: string): boolean => {
  const path = normalize(pathname)
  if (href === "/") {
    return path === "/"
  }
  if (href === "/ho-so/") {
    return path === "/ho-so/" || path.startsWith("/ho-so/lap")
  }
  return path.startsWith(href)
}

const Brand = () => (
  <Link
    className="focus-visible:ring-ring flex items-center gap-3 rounded-md outline-none focus-visible:ring-2"
    href="/"
  >
    <span className="bg-primary text-primary-foreground relative flex size-9 items-center justify-center rounded-lg shadow-sm">
      <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
        <path
          d="M12 2.5 4.5 5.2v6.1c0 4.6 3.1 8.6 7.5 10.2 4.4-1.6 7.5-5.6 7.5-10.2V5.2L12 2.5Z"
          fill="currentColor"
          opacity=".25"
        />
        <path
          d="M12 2.5 4.5 5.2v6.1c0 4.6 3.1 8.6 7.5 10.2 4.4-1.6 7.5-5.6 7.5-10.2V5.2L12 2.5Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
        <path
          d="m12 7 1.4 2.9 3.1.4-2.3 2.2.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.2 3.1-.4L12 7Z"
          fill="var(--gold)"
        />
      </svg>
    </span>
    <span className="flex flex-col leading-tight">
      <span className="text-[15px] font-semibold tracking-tight">Hồ sơ CSKV</span>
      <span className="text-muted-foreground text-xs">Trợ lý lập hồ sơ</span>
    </span>
  </Link>
)

const Nav = ({ onNavigate }: { onNavigate?: () => void }) => {
  const pathname = usePathname()
  return (
    <nav aria-label="Điều hướng chính" className="flex flex-col gap-6">
      {NAV.map((section) => (
        <div className="flex flex-col gap-1" key={section.title}>
          <p className="text-muted-foreground px-3 pb-1 text-[11px] font-semibold tracking-wider uppercase">
            {section.title}
          </p>
          {section.items.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href)
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group text-foreground/75 hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2",
                  active && "bg-primary/10 text-primary hover:bg-primary/12 hover:text-primary"
                )}
                href={href}
                key={href}
                onClick={onNavigate}
              >
                {active ? (
                  <span className="bg-primary absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r" />
                ) : null}
                <Icon className="size-[18px] shrink-0" />
                {label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

const PrivacyNote = () => (
  <div className="bg-card text-muted-foreground flex items-start gap-2.5 rounded-lg border p-3 text-xs">
    <LockIcon className="text-success mt-0.5 size-3.5 shrink-0" />
    <p>Dữ liệu chỉ lưu trên trình duyệt của máy này, không gửi ra ngoài.</p>
  </div>
)

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-dvh">
      <aside className="border-sidebar-border bg-sidebar sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r px-3 py-5 lg:flex print:hidden">
        <div className="px-2">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto">
          <Nav />
        </div>
        <PrivacyNote />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Đóng menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            type="button"
          />
          <aside className="bg-sidebar animate-in slide-in-from-left absolute inset-y-0 left-0 flex w-72 flex-col gap-6 border-r px-3 py-5 shadow-xl">
            <div className="flex items-center justify-between px-2">
              <Brand />
              <Button
                aria-label="Đóng menu"
                onClick={() => setMobileOpen(false)}
                size="icon-sm"
                variant="ghost"
              >
                <XIcon />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Nav onNavigate={() => setMobileOpen(false)} />
            </div>
            <PrivacyNote />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/85 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 backdrop-blur sm:px-6 print:hidden">
          <Button
            aria-label="Mở menu"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            size="icon-sm"
            variant="ghost"
          >
            <MenuIcon />
          </Button>
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild className="hidden sm:inline-flex" size="sm">
              <Link href="/ho-so/moi/">
                <FilePlus2Icon />
                Lập hồ sơ
              </Link>
            </Button>
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  )
}
