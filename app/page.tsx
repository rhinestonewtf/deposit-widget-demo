"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useRef, useEffect } from "react";

const RhinestoneDeposit = dynamic(
  () =>
    import("@rhinestone/deposit-widget/react").then(
      (m) => m.RhinestoneDeposit
    ),
  { ssr: false }
);

const CHAINS: Record<number, string> = {
  8453: "Base",
  10: "Optimism",
  42161: "Arbitrum",
};

const TOKENS: Record<string, { label: string; chain: number }> = {
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913": { label: "USDC", chain: 8453 },
  "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85": { label: "USDC", chain: 10 },
  "0xaf88d065e77c8cC2239327C5EDb3A432268e5831": { label: "USDC", chain: 42161 },
};

const DEFAULT_RECIPIENT = "0x0197d7FaFCA118Bc91f6854B9A2ceea94E676585";

const ACCENT_PRESETS = [
  { label: "Blue", value: "#0090ff" },
  { label: "Indigo", value: "#6e56cf" },
  { label: "Emerald", value: "#30a46c" },
  { label: "Rose", value: "#e5484d" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Neutral", value: "#18181b" },
];

function tokenForChain(chainId: number): string {
  const entry = Object.entries(TOKENS).find(([, t]) => t.chain === chainId);
  return entry ? entry[0] : Object.keys(TOKENS)[0];
}

export default function Home() {
  const [targetChain, setTargetChain] = useState(8453);
  const [targetToken, setTargetToken] = useState(
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  );
  const [accent, setAccent] = useState("#0090ff");
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");
  const [borderRadius, setBorderRadius] = useState(14);
  const [brandTitle, setBrandTitle] = useState("Shrimp Pay");
  const [hideBranding, setHideBranding] = useState(false);
  const [recipient, setRecipient] = useState(DEFAULT_RECIPIENT);
  const [prefilledAmount, setPrefilledAmount] = useState("");
  const [showCode, setShowCode] = useState(false);

  const handleChainChange = useCallback((chainId: number) => {
    setTargetChain(chainId);
    setTargetToken(tokenForChain(chainId));
  }, []);

  const onReady = useCallback(() => console.log("ready"), []);
  const onConnected = useCallback(
    (d: unknown) => console.log("connected", d),
    []
  );
  const onDepositComplete = useCallback(
    (d: unknown) => console.log("complete", d),
    []
  );
  const onError = useCallback((e: unknown) => console.log("error", e), []);

  const widgetKey = `${targetChain}-${targetToken}-${recipient}-${themeMode}-${accent}-${borderRadius}-${brandTitle}-${hideBranding}-${prefilledAmount}`;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* ── Header ──────────────────────────────────────── */}
      <header
        className="h-12 flex items-center justify-between px-5 shrink-0"
        style={{
          borderBottom: "1px solid var(--border-primary)",
          background: "var(--bg-primary)",
        }}
      >
        <div className="flex items-center gap-3">
          <RhinestoneLogo />
          <span
            className="text-[13px] font-semibold tracking-[-0.01em]"
            style={{ color: "var(--text-primary)" }}
          >
            Deposit Widget
          </span>
          <span
            className="text-[11px] font-medium px-2 py-0.5"
            style={{
              background: "var(--bg-surface)",
              color: "var(--text-tertiary)",
              borderRadius: "var(--radius-full)",
            }}
          >
            SDK Demo
          </span>
        </div>
        <a
          href="https://docs.google.com/document/d/1uaOrXAEALpuXsn-jIdTI-DGIichypdeGSUpkE_qNruo/edit?usp=sharing"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[12px] font-medium transition-colors"
          style={{ color: "var(--text-tertiary)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}
        >
          <ExternalLinkIcon />
          Documentation
        </a>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* ── Config Panel ────────────────────────────────── */}
        <aside
          className="config-panel w-[320px] shrink-0 overflow-y-auto"
          style={{
            borderRight: "1px solid var(--border-primary)",
            background: "var(--bg-primary)",
          }}
        >
          <div className="p-5 flex flex-col gap-6">
            {/* Target */}
            <Section title="Destination">
              <Row label="Chain">
                <Pill
                  value={String(targetChain)}
                  onChange={(v) => handleChainChange(Number(v))}
                  options={Object.entries(CHAINS).map(([id, name]) => ({
                    value: id,
                    label: name,
                  }))}
                />
              </Row>
              <Row label="Token">
                <span
                  className="text-[13px] font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  {TOKENS[targetToken]?.label ?? "USDC"} · {CHAINS[targetChain]}
                </span>
              </Row>
              <Row label="Amount">
                <input
                  type="text"
                  inputMode="decimal"
                  value={prefilledAmount}
                  onChange={(e) => setPrefilledAmount(e.target.value)}
                  placeholder="Optional"
                  className="text-[13px] font-medium bg-transparent outline-none text-right w-20"
                  style={{ color: "var(--text-primary)" }}
                />
              </Row>
              <Row label="Recipient">
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="0x..."
                  className="text-[13px] font-mono bg-transparent outline-none text-right w-[170px]"
                  style={{ color: "var(--text-primary)" }}
                />
              </Row>
            </Section>

            {/* Theme */}
            <Section title="Appearance">
              <Row label="Mode">
                <Pill
                  value={themeMode}
                  onChange={(v) => setThemeMode(v as "light" | "dark")}
                  options={[
                    { value: "light", label: "Light" },
                    { value: "dark", label: "Dark" },
                  ]}
                />
              </Row>
              <Row label="Accent">
                <div className="flex items-center gap-1.5">
                  {ACCENT_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setAccent(p.value)}
                      title={p.label}
                      className="size-[18px] rounded-full shrink-0 transition-all"
                      style={{
                        background: p.value,
                        boxShadow:
                          accent === p.value
                            ? `0 0 0 1.5px var(--bg-primary), 0 0 0 3px ${p.value}`
                            : "none",
                        transform: accent === p.value ? "scale(1.15)" : "scale(1)",
                      }}
                    />
                  ))}
                  <label
                    className="size-[18px] rounded-full shrink-0 flex items-center justify-center cursor-pointer transition-colors"
                    style={{ border: "1.5px dashed var(--border-surface)" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor = "var(--text-tertiary)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor = "var(--border-surface)")
                    }
                  >
                    <input
                      type="color"
                      value={accent}
                      onChange={(e) => setAccent(e.target.value)}
                      className="sr-only"
                    />
                    <span
                      className="text-[8px] leading-none"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      +
                    </span>
                  </label>
                </div>
              </Row>
              <Row label="Radius">
                <div className="flex items-center gap-2.5">
                  <input
                    type="range"
                    min={0}
                    max={24}
                    value={borderRadius}
                    onChange={(e) => setBorderRadius(Number(e.target.value))}
                    className="w-16"
                  />
                  <span
                    className="text-[11px] font-mono w-[26px] text-right tabular-nums"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {borderRadius}px
                  </span>
                </div>
              </Row>
            </Section>

            {/* Branding */}
            <Section title="Branding">
              <Row label="Title">
                <input
                  type="text"
                  value={brandTitle}
                  onChange={(e) => setBrandTitle(e.target.value)}
                  placeholder="App name"
                  className="text-[13px] font-medium bg-transparent outline-none text-right w-24"
                  style={{ color: "var(--text-primary)" }}
                />
              </Row>
              <Row label="Hide branding">
                <Toggle checked={hideBranding} onChange={setHideBranding} />
              </Row>
            </Section>

            {/* Code */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowCode(!showCode)}
                className="flex items-center justify-center gap-1.5 h-8 text-[12px] font-medium transition-colors"
                style={{
                  borderRadius: "var(--radius-sm)",
                  background: showCode ? "var(--bg-surface-hover)" : "var(--bg-surface)",
                  color: "var(--text-secondary)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--bg-surface-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = showCode
                    ? "var(--bg-surface-hover)"
                    : "var(--bg-surface)")
                }
              >
                <CodeIcon />
                {showCode ? "Hide Code" : "View Code"}
              </button>

              {showCode && (
                <CodeBlock
                  code={buildCodeString({
                    targetChain,
                    targetToken,
                    recipient,
                    themeMode,
                    accent,
                    borderRadius,
                    brandTitle,
                    hideBranding,
                    prefilledAmount,
                  })}
                />
              )}
            </div>
          </div>
        </aside>

        {/* ── Preview ─────────────────────────────────────── */}
        <main
          className="flex-1 flex items-center justify-center dot-grid"
          style={{ background: "var(--bg-secondary)" }}
        >
          <div className="widget-glow">
            <div style={{ width: 420, boxShadow: "var(--shadow-widget)", borderRadius: "var(--radius-lg)" }}>
              <RhinestoneDeposit
                key={widgetKey}
                targetChain={targetChain}
                targetToken={targetToken}
                recipient={recipient || undefined}
                amount={prefilledAmount || undefined}
                theme={{ mode: themeMode, accent, borderRadius }}
                branding={{
                  title: brandTitle || undefined,
                  hide: hideBranding,
                }}
                onReady={onReady}
                onConnected={onConnected}
                onDepositComplete={onDepositComplete}
                onError={onError}
                style={{ width: "100%" }}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ── Shared UI Components ────────────────────────────────── */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.08em] px-0.5"
        style={{ color: "var(--text-tertiary)" }}
      >
        {title}
      </span>
      <div
        className="flex flex-col divide-y"
        style={{
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-primary)",
          background: "var(--bg-primary)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between h-[44px] px-3.5"
      style={{ borderColor: "var(--border-primary)" }}
    >
      <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function Pill({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div
      className="flex gap-0.5 p-[3px]"
      style={{
        borderRadius: "var(--radius-sm)",
        background: "var(--bg-surface)",
      }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className="text-[12px] font-medium px-2.5 py-[5px] transition-all"
          style={{
            borderRadius: "calc(var(--radius-sm) - 2px)",
            background:
              value === o.value ? "var(--bg-primary)" : "transparent",
            color:
              value === o.value
                ? "var(--text-primary)"
                : "var(--text-tertiary)",
            boxShadow:
              value === o.value ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative w-[34px] h-[20px] rounded-full transition-colors"
      style={{
        background: checked ? "var(--bg-accent)" : "var(--bg-surface)",
      }}
    >
      <span
        className="absolute top-[3px] left-[3px] size-[14px] rounded-full bg-white transition-transform"
        style={{
          transform: checked ? "translateX(14px)" : "translateX(0)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
        }}
      />
    </button>
  );
}

/* ── Code Block ──────────────────────────────────────────── */

function buildCodeString(cfg: {
  targetChain: number;
  targetToken: string;
  recipient: string;
  themeMode: string;
  accent: string;
  borderRadius: number;
  brandTitle: string;
  hideBranding: boolean;
  prefilledAmount: string;
}): string {
  const lines = [
    `<RhinestoneDeposit`,
    `  targetChain={${cfg.targetChain}}`,
    `  targetToken="${cfg.targetToken}"`,
  ];
  if (cfg.recipient) {
    lines.push(`  recipient="${cfg.recipient}"`);
  }
  if (cfg.prefilledAmount) {
    lines.push(`  amount="${cfg.prefilledAmount}"`);
  }
  lines.push(
    `  theme={{`,
    `    mode: "${cfg.themeMode}",`,
    `    accent: "${cfg.accent}",`,
    `    borderRadius: ${cfg.borderRadius},`,
    `  }}`,
  );
  if (cfg.brandTitle || cfg.hideBranding) {
    const brandLines = [];
    if (cfg.brandTitle) brandLines.push(`    title: "${cfg.brandTitle}",`);
    if (cfg.hideBranding) brandLines.push(`    hide: true,`);
    lines.push(`  branding={{`, ...brandLines, `  }}`);
  }
  lines.push(`/>`);
  return lines.join("\n");
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    });
  }, [code]);

  return (
    <div
      className="relative group"
      style={{ borderRadius: "var(--radius-sm)", overflow: "hidden" }}
    >
      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          borderRadius: "var(--radius-sm)",
          background: "rgba(255,255,255,0.1)",
          color: "#a1a1aa",
        }}
      >
        {copied ? (
          <>
            <CheckIcon />
            Copied
          </>
        ) : (
          <>
            <CopyIcon />
            Copy
          </>
        )}
      </button>
      <pre
        className="font-mono text-[10.5px] leading-[1.7] p-3 overflow-x-auto"
        style={{ background: "#18181b", color: "#a1a1aa", margin: 0 }}
      >
        {code}
      </pre>
    </div>
  );
}

/* ── Icons ───────────────────────────────────────────────── */

function RhinestoneLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect width="20" height="20" rx="5" fill="var(--text-primary)" />
      <path
        d="M6 14L10 6L14 14"
        stroke="var(--bg-primary)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 11.5H12.5"
        stroke="var(--bg-primary)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}
