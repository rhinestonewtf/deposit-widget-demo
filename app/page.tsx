"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAccount, useWalletClient, usePublicClient, useSwitchChain, useDisconnect } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { DepositModal } from "@rhinestone/deposit-modal";
import type { Address } from "viem";

type DemoMode = "modal" | "iframe";

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
const WIDGET_BASE_URL = "https://deposit.rhinestone.dev";

function preventScrollJump(e: React.FocusEvent) {
  const scrollPositions: [HTMLElement, number, number][] = [];
  let el: HTMLElement | null = e.target as HTMLElement;
  while ((el = el.parentElement)) {
    scrollPositions.push([el, el.scrollTop, el.scrollLeft]);
  }
  requestAnimationFrame(() => {
    for (const [node, top, left] of scrollPositions) {
      node.scrollTop = top;
      node.scrollLeft = left;
    }
  });
}

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
  const [mode, setMode] = useState<DemoMode>("modal");
  const [targetChain, setTargetChain] = useState(8453);
  const [targetToken, setTargetToken] = useState(
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  );
  const [accent, setAccent] = useState("#0090ff");
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");
  const [borderRadius, setBorderRadius] = useState(14);
  const [brandTitle, setBrandTitle] = useState("Deposit");
  const [logoUrl, setLogoUrl] = useState("https://github.com/rhinestonewtf.png");

  const [recipient, setRecipient] = useState(DEFAULT_RECIPIENT);
  const [prefilledAmount, setPrefilledAmount] = useState("");
  const [waitForFinalTx, setWaitForFinalTx] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [showModal, setShowModal] = useState(true);

  // Wagmi hooks for modal mode
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { disconnect } = useDisconnect();
  const { open: openAppKit } = useAppKit();

  const handleChainChange = useCallback((chainId: number) => {
    setTargetChain(chainId);
    setTargetToken(tokenForChain(chainId));
  }, []);

  const handleSwitchChain = useCallback(
    async (chainId: number) => {
      await switchChainAsync({ chainId });
    },
    [switchChainAsync]
  );

  const onDepositComplete = useCallback(
    (d: unknown) => console.log("complete", d),
    []
  );
  const onError = useCallback((e: unknown) => console.log("error", e), []);

  const componentKey = `${targetChain}-${targetToken}-${recipient}-${themeMode}-${accent}-${borderRadius}-${brandTitle}-${logoUrl}-${prefilledAmount}-${waitForFinalTx}`;

  const truncatedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null;

  // Build iframe URL with params
  const iframeUrl = buildIframeUrl({
    targetChain,
    targetToken,
    recipient,
    amount: prefilledAmount,
    themeMode,
    accent,
    borderRadius,
    brandTitle,
    logoUrl,
    waitForFinalTx,
  });

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
            Deposit {mode === "modal" ? "Modal" : "Widget"}
          </span>
          <span
            className="text-[11px] font-medium px-2 py-0.5"
            style={{
              background: "var(--bg-surface)",
              color: "var(--text-tertiary)",
              borderRadius: "var(--radius-full)",
            }}
          >
            Demo
          </span>
        </div>

        <div className="flex items-center gap-3">
          {mode === "modal" && (
            <>
              {isConnected ? (
                <button
                  onClick={() => disconnect()}
                  className="flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 transition-colors"
                  style={{
                    background: "var(--bg-surface)",
                    color: "var(--text-secondary)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <span>{truncatedAddress}</span>
                  <span style={{ color: "var(--text-tertiary)" }}>·</span>
                  <span style={{ color: "var(--text-error, #e5484d)" }}>Disconnect</span>
                </button>
              ) : (
                <button
                  onClick={() => openAppKit()}
                  className="flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 transition-colors"
                  style={{
                    background: "var(--bg-accent)",
                    color: "white",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  Connect Wallet
                </button>
              )}
            </>
          )}
          <a
            href="https://docs.rhinestone.wtf"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[12px] font-medium transition-colors"
            style={{ color: "var(--text-tertiary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}
          >
            <ExternalLinkIcon />
            Docs
          </a>
        </div>
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
            {/* Mode Toggle */}
            <Section title="Mode">
              <Row label="Integration">
                <Pill
                  value={mode}
                  onChange={(v) => setMode(v as DemoMode)}
                  options={[
                    { value: "modal", label: "Modal" },
                    { value: "iframe", label: "Iframe" },
                  ]}
                />
              </Row>
              {mode === "modal" && (
                <Row label="Show Modal">
                  <Toggle checked={showModal} onChange={setShowModal} />
                </Row>
              )}
            </Section>

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
              <Row label={<LabelWithInfo text="Recipient" tooltip="The address where deposited funds are sent. Set this to the user's address when installing the widget." />}>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="0x..."
                  className="text-[13px] font-mono bg-transparent outline-none text-right w-[110px] text-ellipsis overflow-hidden"
                  style={{ color: "var(--text-primary)" }}
                />
              </Row>
              <Row label={<LabelWithInfo text="Wait for final tx" tooltip="For faster transaction confirmation, Rhinestone marks an intent as complete when the solver delivers a pre-confirmation." />}>
                <Toggle checked={waitForFinalTx} onChange={setWaitForFinalTx} />
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
                    className="relative size-[18px] rounded-full shrink-0 flex items-center justify-center cursor-pointer transition-colors"
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
                      className="absolute inset-0 opacity-0 pointer-events-none"
                      tabIndex={-1}
                      onFocus={preventScrollJump}
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
              <Row label="Icon URL">
                <input
                  type="text"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://..."
                  className="text-[13px] font-medium bg-transparent outline-none text-right w-[110px] text-ellipsis overflow-hidden"
                  style={{ color: "var(--text-primary)" }}
                />
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
                  code={
                    mode === "modal"
                      ? buildModalCodeString({
                          targetChain,
                          targetToken,
                          recipient,
                          themeMode,
                          accent,
                          borderRadius,
                          brandTitle,
                          logoUrl,
                          prefilledAmount,
                          waitForFinalTx,
                        })
                      : buildIframeCodeString(iframeUrl)
                  }
                />
              )}
            </div>
          </div>
        </aside>

        {/* ── Preview ─────────────────────────────────────── */}
        <main
          className="flex-1 flex items-center justify-center dot-grid overflow-hidden"
          style={{ background: "var(--bg-secondary)" }}
        >
          <div className="widget-glow">
            <div style={{ width: 420, boxShadow: "var(--shadow-widget)", borderRadius: `${borderRadius}px`, overflow: "hidden" }}>
              {mode === "modal" ? (
                showModal ? (
                  <DepositModal
                    key={componentKey}
                    isOpen={true}
                    onClose={() => setShowModal(false)}
                    walletClient={walletClient}
                    publicClient={publicClient}
                    address={address}
                    switchChain={handleSwitchChain}
                    targetChain={targetChain}
                    targetToken={targetToken as Address}
                    recipient={recipient as Address || undefined}
                    defaultAmount={prefilledAmount || undefined}
                    waitForFinalTx={waitForFinalTx}
                    theme={{
                      mode: themeMode,
                      primary: accent,
                      radius: borderRadius <= 4 ? "sm" : borderRadius <= 10 ? "md" : "lg",
                    }}
                    branding={{
                      title: brandTitle || undefined,
                      logoUrl: logoUrl || undefined,
                    }}
                    onRequestConnect={() => openAppKit()}
                    onDepositComplete={onDepositComplete}
                    onError={onError}
                    inline={true}
                  />
                ) : (
                  <ModalPlaceholder onOpen={() => setShowModal(true)} />
                )
              ) : (
                <iframe
                  key={componentKey}
                  src={iframeUrl}
                  style={{
                    width: "100%",
                    height: 500,
                    border: "none",
                  }}
                  allow="clipboard-write"
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ── Placeholder for Modal ──────────────────────────────── */

function ModalPlaceholder({ onOpen }: { onOpen: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 p-8"
      style={{
        background: "var(--bg-primary)",
        minHeight: 300,
      }}
    >
      <div
        className="flex items-center justify-center size-16 rounded-full"
        style={{ background: "var(--bg-surface)" }}
      >
        <WalletIcon />
      </div>
      <div className="text-center">
        <div className="text-[15px] font-medium" style={{ color: "var(--text-primary)" }}>
          Modal is closed
        </div>
        <div className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>
          Toggle &quot;Show Modal&quot; or click below to open
        </div>
      </div>
      <button
        onClick={onOpen}
        className="text-[13px] font-medium px-4 py-2 transition-colors"
        style={{
          background: "var(--bg-accent)",
          color: "white",
          borderRadius: "var(--radius-sm)",
        }}
      >
        Open Modal
      </button>
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

function LabelWithInfo({ text, tooltip }: { text: string; tooltip: string }) {
  return (
    <span className="relative flex items-center gap-1.5 group/info">
      {text}
      <span
        className="flex items-center justify-center size-[15px] rounded-full shrink-0"
        style={{
          background: "var(--border-surface)",
          color: "var(--text-secondary)",
        }}
      >
        <span className="text-[9px] font-bold leading-none" style={{ marginTop: "0.5px" }}>i</span>
      </span>
      <div
        className="absolute left-0 top-full mt-1.5 z-10 w-52 p-2 text-[11px] leading-[1.5] font-normal opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-opacity"
        style={{
          background: "var(--bg-primary)",
          color: "var(--text-secondary)",
          border: "1px solid var(--border-primary)",
          borderRadius: "var(--radius-sm)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        {tooltip}
      </div>
    </span>
  );
}

function Row({
  label,
  children,
}: {
  label: React.ReactNode;
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

/* ── Code Generation ─────────────────────────────────────── */

function buildIframeUrl(cfg: {
  targetChain: number;
  targetToken: string;
  recipient: string;
  amount: string;
  themeMode: string;
  accent: string;
  borderRadius: number;
  brandTitle: string;
  logoUrl: string;
  waitForFinalTx: boolean;
}): string {
  const params = new URLSearchParams();
  params.set("targetChain", String(cfg.targetChain));
  params.set("targetToken", cfg.targetToken);
  if (cfg.recipient) params.set("recipient", cfg.recipient);
  if (cfg.amount) params.set("amount", cfg.amount);
  if (cfg.themeMode === "dark") params.set("theme", "dark");
  if (cfg.accent) params.set("accent", cfg.accent);
  if (cfg.borderRadius) params.set("borderRadius", String(cfg.borderRadius));
  if (cfg.brandTitle) params.set("brandTitle", cfg.brandTitle);
  if (cfg.logoUrl) params.set("logoUrl", cfg.logoUrl);
  if (!cfg.waitForFinalTx) params.set("waitForFinalTx", "false");
  return `${WIDGET_BASE_URL}?${params.toString()}`;
}

function buildModalCodeString(cfg: {
  targetChain: number;
  targetToken: string;
  recipient: string;
  themeMode: string;
  accent: string;
  borderRadius: number;
  brandTitle: string;
  logoUrl: string;
  prefilledAmount: string;
  waitForFinalTx: boolean;
}): string {
  const lines = [
    `import { DepositModal } from "@rhinestone/deposit-modal";`,
    `import "@rhinestone/deposit-modal/styles.css";`,
    ``,
    `// In your component with wagmi hooks:`,
    `// const { address } = useAccount();`,
    `// const { data: walletClient } = useWalletClient();`,
    `// const publicClient = usePublicClient();`,
    ``,
    `<DepositModal`,
    `  isOpen={isOpen}`,
    `  onClose={() => setIsOpen(false)}`,
    `  walletClient={walletClient}`,
    `  publicClient={publicClient}`,
    `  address={address}`,
    `  targetChain={${cfg.targetChain}}`,
    `  targetToken="${cfg.targetToken}"`,
  ];
  if (cfg.recipient) {
    lines.push(`  recipient="${cfg.recipient}"`);
  }
  if (cfg.prefilledAmount) {
    lines.push(`  defaultAmount="${cfg.prefilledAmount}"`);
  }
  if (!cfg.waitForFinalTx) {
    lines.push(`  waitForFinalTx={false}`);
  }
  lines.push(`  theme={{`);
  lines.push(`    mode: "${cfg.themeMode}",`);
  lines.push(`    primary: "${cfg.accent}",`);
  const radius = cfg.borderRadius <= 4 ? "sm" : cfg.borderRadius <= 10 ? "md" : "lg";
  lines.push(`    radius: "${radius}",`);
  lines.push(`  }}`);
  if (cfg.brandTitle || cfg.logoUrl) {
    lines.push(`  branding={{`);
    if (cfg.brandTitle) lines.push(`    title: "${cfg.brandTitle}",`);
    if (cfg.logoUrl) lines.push(`    logoUrl: "${cfg.logoUrl}",`);
    lines.push(`  }}`);
  }
  lines.push(`  onDepositComplete={(data) => console.log("Complete", data)}`);
  lines.push(`/>`);
  return lines.join("\n");
}

function buildIframeCodeString(url: string): string {
  return `<!-- Embed the Rhinestone Deposit Widget -->
<iframe
  src="${url}"
  width="420"
  height="500"
  frameborder="0"
  allow="clipboard-write"
></iframe>

<!-- Listen for events from the widget -->
<script>
window.addEventListener("message", (event) => {
  if (event.data?.type?.startsWith("rhinestone:")) {
    console.log(event.data.type, event.data.data);
    // Handle events:
    // - rhinestone:ready
    // - rhinestone:connected
    // - rhinestone:deposit-submitted
    // - rhinestone:deposit-complete
    // - rhinestone:deposit-failed
  }
});
</script>`;
}

/* ── Code Block ──────────────────────────────────────────── */

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

function WalletIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--text-tertiary)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12V7H5a2 2 0 010-4h14v4" />
      <path d="M3 5v14a2 2 0 002 2h16v-5" />
      <path d="M18 12a2 2 0 100 4h4v-4h-4z" />
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
