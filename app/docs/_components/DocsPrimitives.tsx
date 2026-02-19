import type { ReactNode } from "react";

export function PageIndex({ children }: { children: ReactNode }) {
  return (
    <p
      className="mb-3 text-[11px] font-semibold uppercase tracking-[0.11em]"
      style={{
        color: "var(--bg-accent)",
        fontFamily: "var(--font-code), var(--font-geist-mono), monospace",
      }}
    >
      {children}
    </p>
  );
}

export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <h1
      className="mb-5 text-[32px] leading-[1.05] tracking-[-0.03em]"
      style={{
        color: "var(--text-primary)",
        fontFamily: "var(--font-display), Georgia, serif",
      }}
    >
      {children}
    </h1>
  );
}

export function Lead({ children }: { children: ReactNode }) {
  return (
    <p
      className="mb-4 text-[15px] leading-[1.75]"
      style={{ color: "var(--text-secondary)" }}
    >
      {children}
    </p>
  );
}

export function P({ children }: { children: ReactNode }) {
  return (
    <p
      className="mb-3 text-[14px] leading-[1.75]"
      style={{ color: "var(--text-secondary)" }}
    >
      {children}
    </p>
  );
}

export function Subheading({ children }: { children: ReactNode }) {
  return (
    <h2
      className="mb-2 mt-7 text-[15px] font-semibold"
      style={{ color: "var(--text-primary)" }}
    >
      {children}
    </h2>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return (
    <code
      className="rounded-[5px] px-1.5 py-[2px] text-[12px]"
      style={{
        border: "1px solid var(--border-primary)",
        background: "var(--bg-surface)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-code), var(--font-geist-mono), monospace",
      }}
    >
      {children}
    </code>
  );
}

export function Callout({ children }: { children: ReactNode }) {
  return (
    <div
      className="mt-4 rounded-[10px] px-4 py-3 text-[13px] leading-[1.7]"
      style={{
        color: "var(--text-secondary)",
        background: "rgba(0, 144, 255, 0.06)",
        border: "1px solid rgba(0, 144, 255, 0.18)",
      }}
    >
      {children}
    </div>
  );
}

export function CodeBlock({
  children,
  lang,
}: {
  children: string;
  lang: string;
}) {
  return (
    <div
      className="mb-3 overflow-hidden rounded-[10px]"
      style={{
        border: "1px solid var(--border-primary)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        className="px-3 py-1.5 text-[10px] uppercase tracking-[0.08em]"
        style={{
          borderBottom: "1px solid var(--border-primary)",
          background: "var(--bg-secondary)",
          color: "var(--text-tertiary)",
          fontFamily: "var(--font-code), var(--font-geist-mono), monospace",
        }}
      >
        {lang}
      </div>
      <pre
        className="m-0 overflow-x-auto p-3.5 text-[12px] leading-[1.7]"
        style={{
          background: "#fafafa",
          color: "#27272a",
          fontFamily: "var(--font-code), var(--font-geist-mono), monospace",
        }}
      >
        {children}
      </pre>
    </div>
  );
}

export function NumberedList({
  items,
}: {
  items: { title: string; body: string }[];
}) {
  return (
    <div className="mt-3 flex flex-col gap-2.5">
      {items.map((item, index) => (
        <div
          key={item.title}
          className="rounded-[10px] p-3.5"
          style={{
            border: "1px solid var(--border-primary)",
            background: "var(--bg-secondary)",
          }}
        >
          <p className="mb-1 text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
            {index + 1}. {item.title}
          </p>
          <p className="text-[13px] leading-[1.7]" style={{ color: "var(--text-secondary)" }}>
            {item.body}
          </p>
        </div>
      ))}
    </div>
  );
}
