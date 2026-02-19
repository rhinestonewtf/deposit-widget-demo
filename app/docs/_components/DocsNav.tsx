"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/docs/overview", label: "Overview", index: "01" },
  { href: "/docs/quickstart", label: "Quickstart", index: "02" },
  { href: "/docs/architecture", label: "Architecture", index: "03" },
] as const;

export function DocsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2 rounded-[8px] px-2.5 py-2 text-[13px] transition-colors"
            style={{
              color: active ? "var(--text-primary)" : "var(--text-secondary)",
              background: active ? "var(--bg-surface)" : "transparent",
              fontWeight: active ? 600 : 400,
            }}
          >
            <span
              className="text-[10px]"
              style={{
                color: active ? "var(--bg-accent)" : "var(--text-tertiary)",
                fontFamily: "var(--font-code), var(--font-geist-mono), monospace",
              }}
            >
              {item.index}
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
