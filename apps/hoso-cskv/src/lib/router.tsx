"use client"

/**
 * Bộ định tuyến dùng dấu # trên địa chỉ (ví dụ: index.html#/ho-so/).
 * Nhờ vậy phần mềm chạy được khi mở trực tiếp file index.html (không cần máy chủ),
 * và vẫn chạy bình thường khi đặt trên máy chủ web.
 */
import type * as React from "react"
import { useMemo, useSyncExternalStore } from "react"

const subscribe = (onChange: () => void): (() => void) => {
  window.addEventListener("hashchange", onChange)
  return () => window.removeEventListener("hashchange", onChange)
}

const getHash = (): string => window.location.hash
const getServerHash = (): string => ""

const parse = (hash: string): { path: string; query: string } => {
  const raw = hash.replace(/^#/, "") || "/"
  const [p = "/", q = ""] = raw.split("?")
  const path = p.endsWith("/") ? p : `${p}/`
  return { path: path.startsWith("/") ? path : `/${path}`, query: q }
}

export const usePathname = (): string => parse(useSyncExternalStore(subscribe, getHash, getServerHash)).path

export const useSearchParams = (): URLSearchParams => {
  const { query } = parse(useSyncExternalStore(subscribe, getHash, getServerHash))
  return useMemo(() => new URLSearchParams(query), [query])
}

export const navigate = (to: string): void => {
  window.location.hash = to
}

export const useRouter = (): { push: (to: string) => void } => ({ push: navigate })

type LinkProps = Omit<React.ComponentProps<"a">, "href"> & { href: string }

export const Link = ({ href, ...props }: LinkProps) => <a href={`#${href}`} {...props} />
