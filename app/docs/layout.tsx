import Image from "next/image";
import Link from "next/link";
import { Playfair_Display, Outfit, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { DocsNav } from "./_components/DocsNav";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-code",
  display: "swap",
});

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${playfair.variable} ${outfit.variable} ${jetbrains.variable} h-screen flex flex-col overflow-hidden`}
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      <header
        className="h-13 shrink-0 flex items-center justify-between px-5"
        style={{
          borderBottom: "1px solid var(--border-primary)",
          background: "var(--bg-primary)",
        }}
      >
        <div className="flex items-center gap-3">
          <Image
            src="https://github.com/rhinestonewtf.png"
            alt="Rhinestone"
            width={22}
            height={22}
            style={{ borderRadius: 5 }}
          />
          <span className="text-[13px] font-semibold tracking-[-0.01em]">
            Deposit Modal Docs
          </span>
        </div>

        <Link
          href="/"
          className="rounded-[8px] px-3 py-1.5 text-[12px]"
          style={{
            border: "1px solid var(--border-primary)",
            background: "var(--bg-secondary)",
            color: "var(--text-secondary)",
          }}
        >
          Back to Demo
        </Link>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside
          className="overflow-y-auto px-4 py-6"
          style={{ borderRight: "1px solid var(--border-primary)" }}
        >
          <div
            className="rounded-[12px] p-3"
            style={{
              border: "1px solid var(--border-primary)",
              background: "var(--bg-secondary)",
            }}
          >
            <p
              className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Pages
            </p>
            <DocsNav />
          </div>
        </aside>

        <main className="min-w-0 overflow-y-auto">
          <div className="mx-auto w-full max-w-[860px] px-6 py-10 lg:py-12">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
