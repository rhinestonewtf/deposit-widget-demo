"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  type ReactNode,
  type FocusEvent as ReactFocusEvent,
} from "react";
import {
  NATIVE_TOKEN_ADDRESS,
  SOURCE_CHAINS,
  SOLANA_TOKENS,
  DEFAULT_BACKEND_URL,
  getTokenAddress,
  getSupportedTokenSymbolsForChain,
  getSolanaTokenByMint,
  getSolanaTokenBySymbol,
} from "@rhinestone/deposit-modal/constants";
import {
  DepositModal,
  type DepositLifecycleEvent,
} from "@rhinestone/deposit-modal";
import { isAddress, type Address } from "viem";

/* ─────────────────────────────────────────────────────────────
   Constants
   ───────────────────────────────────────────────────────────── */

const DEFAULT_OWNER_ADDRESS = "0x0197d7FaFCA118Bc91f6854B9A2ceea94E676585";

const MAINNET_CHAIN_IDS = new Set([1, 8453, 42161, 10, 137, 56, 1868, 9745]);

function getSelectableSymbolsForChain(chainId: number | "solana"): string[] {
  if (chainId === "solana") return SOLANA_TOKENS.map((t) => t.symbol);
  return getSupportedTokenSymbolsForChain(chainId).filter((symbol) => {
    if (symbol.toUpperCase() === "ETH") return true;
    return Boolean(getTokenAddress(symbol, chainId));
  });
}

// EVM-only chain options — for selectors that can't accept a Solana value
// (session chains are always EVM).
const EVM_CHAIN_OPTIONS: { id: number; label: string }[] = SOURCE_CHAINS.filter(
  (chain) =>
    MAINNET_CHAIN_IDS.has(chain.id) &&
    getSelectableSymbolsForChain(chain.id).length > 0,
).map((chain) => ({ id: chain.id, label: chain.name }));

// Full chain options including Solana — for the destination selector only.
const CHAIN_OPTIONS: { id: number | "solana"; label: string }[] = [
  ...EVM_CHAIN_OPTIONS,
  { id: "solana", label: "Solana" },
];

const COLOR_PRESETS = [
  { label: "Zinc", value: "#18181b" },
  { label: "Indigo", value: "#5436f5" },
  { label: "Emerald", value: "#10b981" },
  { label: "Sky", value: "#0ea5e9" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Violet", value: "#a855f7" },
];

const FONT_FAMILIES = [
  { value: "inter", label: "Inter" },
  { value: "geist", label: "Geist" },
  { value: "system", label: "System" },
  { value: "mono", label: "Monospace" },
];

const RADIUS_OPTIONS: { value: "none" | "sm" | "md" | "lg"; px: number }[] = [
  { value: "none", px: 0 },
  { value: "sm", px: 8 },
  { value: "md", px: 12 },
  { value: "lg", px: 16 },
];

function pxToRadius(px: number): "none" | "sm" | "md" | "lg" {
  let closest = RADIUS_OPTIONS[0];
  let minDiff = Infinity;
  for (const opt of RADIUS_OPTIONS) {
    const diff = Math.abs(opt.px - px);
    if (diff < minDiff) {
      minDiff = diff;
      closest = opt;
    }
  }
  return closest.value;
}

// The radius the modal applies to its outer container per theme token — mirror
// of RADIUS_SCALE[*].lg in @rhinestone/deposit-modal's theme. The preview
// wrapper rounds to the same value so its drop shadow hugs the modal instead of
// detaching at the corners (the wrapper used to hardcode 16px, which never
// matched the modal's actual radius).
const MODAL_OUTER_RADIUS_PX: Record<"none" | "sm" | "md" | "lg", number> = {
  none: 0,
  sm: 8,
  md: 14,
  lg: 18,
};

function resolveTokenAddress(
  chainId: number | "solana",
  symbol: string,
): string {
  if (chainId === "solana")
    return getSolanaTokenBySymbol(symbol)?.mint ?? "native";
  if (symbol.toUpperCase() === "ETH") return NATIVE_TOKEN_ADDRESS;
  return getTokenAddress(symbol, chainId) ?? NATIVE_TOKEN_ADDRESS;
}

function symbolForToken(chainId: number | "solana", token: string): string {
  if (chainId === "solana") return getSolanaTokenByMint(token)?.symbol ?? "USDC";
  if (token.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()) return "ETH";
  const symbols = getSelectableSymbolsForChain(chainId);
  const matched = symbols.find(
    (symbol) =>
      resolveTokenAddress(chainId, symbol).toLowerCase() ===
      token.toLowerCase(),
  );
  return matched ?? symbols[0] ?? "USDC";
}

function preventScrollJump(e: ReactFocusEvent) {
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

type Tab = "widget" | "appearance" | "behaviour";
type ThemeMode = "light" | "dark" | "system";

/* ─────────────────────────────────────────────────────────────
   Page
   ───────────────────────────────────────────────────────────── */

export default function Home() {
  /* widget */
  const [targetChain, setTargetChain] = useState<number | "solana">(8453);
  const [targetToken, setTargetToken] = useState(
    resolveTokenAddress(8453, "USDC"),
  );
  const [prefilledAmount, setPrefilledAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [recipientManuallyEdited, setRecipientManuallyEdited] = useState(false);
  const [scope, setScope] = useState<"auto" | "custom">("auto");
  const [ownerAddress, setOwnerAddress] = useState(DEFAULT_OWNER_ADDRESS);
  const [customSessionChainIds, setCustomSessionChainIds] = useState<number[]>([
    8453, 42161, 10,
  ]);

  /* appearance */
  const [defaultTheme, setDefaultTheme] = useState<ThemeMode>("system");
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">("light");
  const [accentColor, setAccentColor] = useState("");
  const [customColor, setCustomColor] = useState("");
  const [cornerRadius, setCornerRadius] = useState(12);
  const [fontFamily, setFontFamily] = useState("inter");
  const [primaryText, setPrimaryText] = useState("");
  const [secondaryText, setSecondaryText] = useState("");
  const [backgroundColor, setBackgroundColor] = useState("");

  /* behaviour */
  const [showHistoryButton, setShowHistoryButton] = useState(true);
  const [minDeposit, setMinDeposit] = useState<number | undefined>(undefined);
  const [maxDeposit, setMaxDeposit] = useState<number | undefined>(100);

  /* ui state */
  const [tab, setTab] = useState<Tab>("widget");
  const [showCode, setShowCode] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [widgetState, setWidgetState] = useState<"open" | "closing" | "closed">(
    "open",
  );

  const reownProjectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;
  const rhinestoneApiKey = process.env.NEXT_PUBLIC_RHINESTONE_API_KEY;
  // Point the widget at a deployment-specific backend (e.g. the deposit-widget
  // proxy that fronts the deposit-processor) via env, falling back to the SDK
  // default. Lets the fiat/Swapped deployment target the processor without a
  // code change.
  const backendUrl =
    process.env.NEXT_PUBLIC_DEPOSIT_WIDGET_BACKEND_URL ?? DEFAULT_BACKEND_URL;

  const [solanaRpcUrl] = useState(() =>
    typeof window === "undefined"
      ? "https://demo.rhinestone.dev/api/solana-rpc"
      : `${window.location.origin}/api/solana-rpc`,
  );
  const rpcUrls = useMemo(() => ({ solana: solanaRpcUrl }), [solanaRpcUrl]);

  /* ── sync page theme with preview theme ───────────────────── */
  useEffect(() => {
    document.documentElement.dataset.theme = previewTheme;
  }, [previewTheme]);

  const handleChainChange = useCallback(
    (chainId: number | "solana") => {
      const nextSymbols = getSelectableSymbolsForChain(chainId);
      if (nextSymbols.length === 0) return;
      const previousSymbol = symbolForToken(targetChain, targetToken);
      const nextSymbol = nextSymbols.includes(previousSymbol)
        ? previousSymbol
        : nextSymbols[0];
      setTargetChain(chainId);
      setTargetToken(resolveTokenAddress(chainId, nextSymbol));
    },
    [targetChain, targetToken],
  );

  const onError = useCallback((e: unknown) => console.log("error", e), []);

  const onDepositLifecycle = useCallback(
    (event: DepositLifecycleEvent) => {
      if (event.type !== "connected") return;
      if (recipientManuallyEdited) return;
      setRecipient(event.address);
      setOwnerAddress(event.address);
    },
    [recipientManuallyEdited],
  );

  const availableSessionChainIds = useMemo(
    () => EVM_CHAIN_OPTIONS.map((chain) => chain.id),
    [],
  );

  const sessionChainIds = useMemo(() => {
    if (scope === "auto") return undefined;
    const allowed = new Set(availableSessionChainIds);
    const filtered = customSessionChainIds.filter((chainId) =>
      allowed.has(chainId),
    );
    if (filtered.length > 0) return filtered;
    // Sessions are EVM-only; a Solana destination has no session chain.
    return typeof targetChain === "number" ? [targetChain] : [];
  }, [scope, availableSessionChainIds, customSessionChainIds, targetChain]);

  const toggleSessionChain = useCallback((chainId: number) => {
    setCustomSessionChainIds((prev) =>
      prev.includes(chainId)
        ? prev.filter((id) => id !== chainId)
        : [...prev, chainId],
    );
  }, []);

  const effectiveAccent = customColor || accentColor;
  const radiusToken = pxToRadius(cornerRadius);

  // Appearance props (theme mode, colors, radius) are applied reactively by
  // DepositModal via applyTheme, so they must NOT remount the widget — that
  // would replay the load + open animation on every change. Only props the
  // widget reads at init belong in the key.
  const componentKey = [
    targetChain,
    targetToken,
    prefilledAmount,
    scope,
    customSessionChainIds.join(","),
    showHistoryButton,
    maxDeposit,
    minDeposit,
  ].join("|");

  const codeString = useMemo(
    () =>
      buildModalCodeString({
        targetChain,
        targetToken,
        recipient,
        ownerAddress,
        rhinestoneApiKey,
        themeMode: previewTheme,
        radiusToken,
        prefilledAmount,
        sessionChainIds,
        ctaColor: effectiveAccent,
        fontColor: primaryText,
        iconColor: secondaryText,
        backgroundColor,
        showHistoryButton,
        maxDeposit,
        minDeposit,
      }),
    [
      targetChain,
      targetToken,
      recipient,
      ownerAddress,
      rhinestoneApiKey,
      previewTheme,
      radiusToken,
      prefilledAmount,
      sessionChainIds,
      effectiveAccent,
      primaryText,
      secondaryText,
      backgroundColor,
      showHistoryButton,
      maxDeposit,
      minDeposit,
    ],
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--page-bg)" }}>
      {/* ── Header ───────────────────────────────────── */}
      <header
        className="h-12 flex items-center justify-between px-4 md:px-5 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsConfigOpen((v) => !v)}
            className="md:hidden -ml-1 p-1.5"
            style={{ color: "var(--text-secondary)" }}
            aria-label="Toggle config"
          >
            <MenuIcon />
          </button>
          <RhinestoneWordmark />
        </div>
        <a
          href="https://docs.rhinestone.dev/deposits/overview"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3.5 h-9 text-[13px] font-medium rounded-[8px] transition-colors"
          style={{
            background: "var(--cta-bg)",
            color: "var(--cta-fg)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--cta-bg-hover)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "var(--cta-bg)")
          }
        >
          Read the docs
          <ArrowUpRightIcon />
        </a>
      </header>

      {/* ── Body ────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 relative">
        {isConfigOpen && (
          <button
            type="button"
            aria-label="Close config panel"
            onClick={() => setIsConfigOpen(false)}
            className="md:hidden absolute inset-0 z-20 bg-black/40"
          />
        )}

        {/* Left column — config */}
        <aside
          className={`config-scroll w-[88vw] max-w-[360px] md:w-[360px] shrink-0 overflow-y-auto absolute md:static inset-y-0 left-0 z-30 transition-transform md:transition-none md:translate-x-0 ${
            isConfigOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
          style={{
            background: "var(--page-bg)",
          }}
        >
          <div className="flex flex-col">
            <h1
              className="px-6 py-4 text-[20px] font-semibold tracking-[-0.01em]"
              style={{ color: "var(--text-primary)" }}
            >
              Deposit demo
            </h1>

            {/* Tabs — span the full width of the panel */}
            <div
              className="grid grid-cols-3"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              {(["widget", "appearance", "behaviour"] as Tab[]).map((t) => {
                const active = tab === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className="flex items-center justify-center py-3 text-[14px] font-medium capitalize transition-colors"
                    style={{
                      color: active
                        ? "var(--text-primary)"
                        : "var(--text-tertiary)",
                      background: active ? "var(--well)" : "transparent",
                      borderBottom: active
                        ? "2px solid var(--tab-indicator)"
                        : "2px solid transparent",
                      marginBottom: "-1px",
                    }}
                  >
                    {t}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="px-6 pt-4 pb-10 flex flex-col gap-4">
              {tab === "widget" && (
                <WidgetTab
                  targetChain={targetChain}
                  onChainChange={handleChainChange}
                  targetToken={targetToken}
                  onTokenChange={(symbol) =>
                    setTargetToken(resolveTokenAddress(targetChain, symbol))
                  }
                  prefilledAmount={prefilledAmount}
                  setPrefilledAmount={setPrefilledAmount}
                  recipient={recipient}
                  setRecipient={(v) => {
                    setRecipient(v);
                    setRecipientManuallyEdited(true);
                  }}
                  scope={scope}
                  setScope={setScope}
                  customSessionChainIds={customSessionChainIds}
                  toggleSessionChain={toggleSessionChain}
                />
              )}
              {tab === "appearance" && (
                <AppearanceTab
                  defaultTheme={defaultTheme}
                  setDefaultTheme={setDefaultTheme}
                  accentColor={accentColor}
                  setAccentColor={(c) => {
                    setAccentColor(c);
                    setCustomColor("");
                  }}
                  customColor={customColor}
                  setCustomColor={(c) => {
                    setCustomColor(c);
                    if (c) setAccentColor("");
                  }}
                  cornerRadius={cornerRadius}
                  setCornerRadius={setCornerRadius}
                  fontFamily={fontFamily}
                  setFontFamily={setFontFamily}
                  primaryText={primaryText}
                  setPrimaryText={setPrimaryText}
                  secondaryText={secondaryText}
                  setSecondaryText={setSecondaryText}
                  backgroundColor={backgroundColor}
                  setBackgroundColor={setBackgroundColor}
                />
              )}
              {tab === "behaviour" && (
                <BehaviourTab
                  showHistoryButton={showHistoryButton}
                  setShowHistoryButton={setShowHistoryButton}
                  minDeposit={minDeposit}
                  setMinDeposit={setMinDeposit}
                  maxDeposit={maxDeposit}
                  setMaxDeposit={setMaxDeposit}
                />
              )}
            </div>
          </div>
        </aside>

        {/* Right column — preview */}
        <main
          className="flex-1 flex flex-col p-2 md:p-2 min-h-0 overflow-hidden"
          style={{ background: "var(--page-bg)" }}
        >
          <div
            className="flex-1 rounded-[24px] relative overflow-y-auto"
            style={{
              background: "var(--preview-bg)",
            }}
          >
          <div className="min-h-full flex flex-col items-center gap-6 py-6 px-3 md:px-4">
            {/* Light / Dark toggle */}
            <div
              className="inline-flex items-center gap-1 p-1 rounded-[8px] shrink-0"
              style={{
                background: "var(--toggle-track)",
              }}
            >
              {(["light", "dark"] as const).map((m) => {
                const active = previewTheme === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPreviewTheme(m)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-[14px] font-medium rounded-[4px] transition-colors capitalize"
                    style={{
                      background: active
                        ? "var(--toggle-active)"
                        : "transparent",
                      boxShadow: active ? "var(--toggle-active-shadow)" : "none",
                      color: active
                        ? "var(--text-primary)"
                        : "var(--text-secondary)",
                    }}
                  >
                    {m === "light" ? <SunIcon /> : <MoonIcon />}
                    {m}
                  </button>
                );
              })}
            </div>

            {/* Flip card */}
            <div className="w-full flex-1 flex items-center justify-center">
              <div className="flip-scene">
                <div className={`flip-card ${showCode ? "is-flipped" : ""}`}>
                  {/* Front: modal */}
                  <div className="flip-face flip-face--front">
                    {widgetState === "closed" ? (
                      <LaunchWidgetCard
                        onLaunch={() => setWidgetState("open")}
                      />
                    ) : (
                    <div
                      className={
                        widgetState === "closing" ? "widget-exit" : "widget-enter"
                      }
                      onAnimationEnd={(e) => {
                        if (
                          widgetState === "closing" &&
                          e.animationName === "widget-exit"
                        ) {
                          setWidgetState("closed");
                        }
                      }}
                      style={{
                        width: "100%",
                        boxShadow: "var(--shadow-widget)",
                        // Match the modal's own outer radius so the shadow hugs
                        // it; the modal already clips its content, so no
                        // wrapper overflow:hidden (which clipped the corners).
                        borderRadius: MODAL_OUTER_RADIUS_PX[radiusToken],
                      }}
                    >
                      {targetChain === "solana" &&
                      !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(
                        (recipient ?? "").trim(),
                      ) ? (
                        <div
                          className="flex flex-col items-center justify-center text-center gap-2 px-6"
                          style={{
                            background: "var(--surface)",
                            color: "var(--text-tertiary)",
                            height: 500,
                          }}
                        >
                          <div
                            className="text-[13px] font-medium"
                            style={{ color: "var(--text-primary)" }}
                          >
                            Enter a Solana recipient to continue
                          </div>
                          <div className="text-[12px]">
                            Solana destinations require a base58 recipient (32-44
                            chars). Type one into the Recipient field, then the
                            deposit modal will render.
                          </div>
                        </div>
                      ) : (
                        <DepositModal
                          key={componentKey}
                          isOpen={true}
                          onClose={() => setWidgetState("closing")}
                          debug={true}
                          backendUrl={backendUrl}
                          rpcUrls={rpcUrls}
                          dappAddress={
                            isAddress(ownerAddress, { strict: false })
                              ? (ownerAddress as Address)
                              : undefined
                          }
                          reownAppId={reownProjectId}
                          targetChain={targetChain}
                          targetToken={targetToken as Address}
                          recipient={(recipient as Address) || undefined}
                          defaultAmount={prefilledAmount || undefined}
                          sessionChainIds={sessionChainIds}
                          theme={{
                            mode: previewTheme,
                            radius: radiusToken,
                            fontColor: primaryText || undefined,
                            iconColor: secondaryText || undefined,
                            ctaColor: effectiveAccent || undefined,
                            backgroundColor: backgroundColor || undefined,
                          }}
                          uiConfig={{
                            showHistoryButton,
                            maxDepositUsd: maxDeposit,
                            minDepositUsd: minDeposit,
                          }}
                          dappImports={{ polymarket: true }}
                          enableFiatOnramp={true}
                          enableExchangeConnect={true}
                          onLifecycle={onDepositLifecycle}
                          onError={onError}
                          inline={true}
                        />
                      )}
                    </div>
                    )}
                  </div>

                  {/* Back: code */}
                  <div className="flip-face flip-face--back">
                    <CodeCard code={codeString} />
                  </div>
                </div>
              </div>
            </div>

            {/* Get the code / Back to customise */}
            <button
              type="button"
              onClick={() => setShowCode((v) => !v)}
              className="inline-flex items-center gap-2 px-3.5 h-9 text-[13px] font-medium rounded-[8px] transition-colors shrink-0"
              style={{
                background: "var(--cta-bg)",
                color: "var(--cta-fg)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--cta-bg-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "var(--cta-bg)")
              }
            >
              {showCode ? (
                <>
                  <ArrowLeftIcon />
                  Back to customise
                </>
              ) : (
                <>
                  <CodeIcon />
                  Get the code
                </>
              )}
            </button>
          </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Launch widget card (shown when the preview widget is closed)
   ───────────────────────────────────────────────────────────── */

function LaunchWidgetCard({ onLaunch }: { onLaunch: () => void }) {
  return (
    <div
      className="widget-enter w-full flex flex-col items-center justify-center gap-4 rounded-[16px] px-6 py-16 text-center"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-widget)",
      }}
    >
      <div className="flex flex-col gap-1">
        <span
          className="text-[14px] font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Widget closed
        </span>
        <span
          className="text-[12px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          The deposit widget was dismissed.
        </span>
      </div>
      <button
        type="button"
        onClick={onLaunch}
        className="inline-flex items-center gap-2 px-3.5 h-9 text-[13px] font-medium rounded-[8px] transition-colors"
        style={{ background: "var(--cta-bg)", color: "var(--cta-fg)" }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "var(--cta-bg-hover)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = "var(--cta-bg)")
        }
      >
        Launch widget
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Tab panels
   ───────────────────────────────────────────────────────────── */

function WidgetTab(props: {
  targetChain: number | "solana";
  onChainChange: (chainId: number | "solana") => void;
  targetToken: string;
  onTokenChange: (symbol: string) => void;
  prefilledAmount: string;
  setPrefilledAmount: (v: string) => void;
  recipient: string;
  setRecipient: (v: string) => void;
  scope: "auto" | "custom";
  setScope: (v: "auto" | "custom") => void;
  customSessionChainIds: number[];
  toggleSessionChain: (chainId: number) => void;
}) {
  return (
    <>
      <Field label="Default chain">
        <SelectInput
          value={String(props.targetChain)}
          onChange={(v) =>
            props.onChainChange(v === "solana" ? "solana" : Number(v))
          }
          placeholder="Select"
          options={CHAIN_OPTIONS.map((c) => ({
            value: String(c.id),
            label: c.label,
          }))}
        />
      </Field>
      <Field label="Default token">
        <SelectInput
          value={symbolForToken(props.targetChain, props.targetToken)}
          onChange={props.onTokenChange}
          placeholder="Select"
          options={getSelectableSymbolsForChain(props.targetChain).map((s) => ({
            value: s,
            label: s,
          }))}
        />
      </Field>
      <Field label="Default amount">
        <TextInput
          value={props.prefilledAmount}
          onChange={props.setPrefilledAmount}
          placeholder="0.00"
          inputMode="decimal"
        />
      </Field>
      <Field label="Recipient address">
        <TextInput
          value={props.recipient}
          onChange={props.setRecipient}
          placeholder="0x..."
          mono
        />
      </Field>
      <SectionLabel>SESSION SIGNING</SectionLabel>
      <Field label="Scope">
        <SelectInput
          value={props.scope}
          onChange={(v) => props.setScope(v as "auto" | "custom")}
          options={[
            { value: "auto", label: "Auto" },
            { value: "custom", label: "Custom" },
          ]}
        />
      </Field>
      {props.scope === "custom" && (
        <div className="flex flex-wrap gap-1.5">
          {EVM_CHAIN_OPTIONS.map((chain) => {
            const selected = props.customSessionChainIds.includes(chain.id);
            return (
              <button
                key={chain.id}
                type="button"
                onClick={() => props.toggleSessionChain(chain.id)}
                className="px-2.5 h-7 text-[11px] font-medium rounded-full transition-colors"
                style={{
                  border: "1px solid var(--border)",
                  background: selected ? "var(--accent)" : "var(--surface)",
                  color: selected ? "#fff" : "var(--text-secondary)",
                }}
              >
                {chain.label}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

function AppearanceTab(props: {
  defaultTheme: ThemeMode;
  setDefaultTheme: (v: ThemeMode) => void;
  accentColor: string;
  setAccentColor: (v: string) => void;
  customColor: string;
  setCustomColor: (v: string) => void;
  cornerRadius: number;
  setCornerRadius: (v: number) => void;
  fontFamily: string;
  setFontFamily: (v: string) => void;
  primaryText: string;
  setPrimaryText: (v: string) => void;
  secondaryText: string;
  setSecondaryText: (v: string) => void;
  backgroundColor: string;
  setBackgroundColor: (v: string) => void;
}) {
  return (
    <>
      <Field label="Default theme">
        <SelectInput
          value={props.defaultTheme}
          onChange={(v) => props.setDefaultTheme(v as ThemeMode)}
          options={[
            { value: "system", label: "System" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <Label>Primary colour</Label>
        <div className="flex items-center gap-2">
          {COLOR_PRESETS.map((preset) => {
            const selected = props.accentColor === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => props.setAccentColor(preset.value)}
                title={preset.label}
                className="size-9 rounded-[8px] transition-all shrink-0"
                style={{
                  background: preset.value,
                  border: selected
                    ? "2px solid var(--text-primary)"
                    : "1px solid var(--border)",
                  outline: selected ? "2px solid var(--surface)" : "none",
                  outlineOffset: selected ? -4 : 0,
                  boxShadow: selected
                    ? "0 0 0 2px var(--text-primary)"
                    : "var(--shadow-sm)",
                }}
              />
            );
          })}
        </div>
      </div>

      <Field label="Custom colour">
        <HexColorInput
          value={props.customColor}
          onChange={props.setCustomColor}
          placeholder="#09090B"
        />
      </Field>

      <Field label="Corner radius">
        <UnitInput
          value={props.cornerRadius}
          onChange={props.setCornerRadius}
          unit="pixels"
        />
      </Field>

      <Field label="Font family">
        <SelectInput
          value={props.fontFamily}
          onChange={props.setFontFamily}
          options={FONT_FAMILIES}
        />
      </Field>

      <Field label="Primary text">
        <HexColorInput
          value={props.primaryText}
          onChange={props.setPrimaryText}
          placeholder="#09090B"
        />
      </Field>

      <Field label="Secondary text">
        <HexColorInput
          value={props.secondaryText}
          onChange={props.setSecondaryText}
          placeholder="#71717B"
        />
      </Field>

      <Field label="Background">
        <HexColorInput
          value={props.backgroundColor}
          onChange={props.setBackgroundColor}
          placeholder="#FAFAFA"
        />
      </Field>
    </>
  );
}

function BehaviourTab(props: {
  showHistoryButton: boolean;
  setShowHistoryButton: (v: boolean) => void;
  minDeposit: number | undefined;
  setMinDeposit: (v: number | undefined) => void;
  maxDeposit: number | undefined;
  setMaxDeposit: (v: number | undefined) => void;
}) {
  return (
    <>
      <ToggleRow
        label="Show history"
        checked={props.showHistoryButton}
        onChange={props.setShowHistoryButton}
      />
      <Field label="Min deposit">
        <TextInput
          value={props.minDeposit === undefined ? "" : String(props.minDeposit)}
          onChange={(v) =>
            props.setMinDeposit(v === "" ? undefined : Number(v))
          }
          placeholder="0.00"
          inputMode="decimal"
        />
      </Field>
      <Field label="Max">
        <TextInput
          value={props.maxDeposit === undefined ? "" : String(props.maxDeposit)}
          onChange={(v) =>
            props.setMaxDeposit(v === "" ? undefined : Number(v))
          }
          placeholder="0.00"
          inputMode="decimal"
        />
      </Field>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   Form primitives
   ───────────────────────────────────────────────────────────── */

function Label({ children }: { children: ReactNode }) {
  return (
    <span
      className="text-[12px] font-medium"
      style={{ color: "var(--text-secondary)" }}
    >
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span
      className="text-[11px] font-medium uppercase tracking-[0.06em] mt-2"
      style={{ color: "var(--text-tertiary)" }}
    >
      {children}
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  inputMode,
  mono,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "decimal" | "numeric";
  mono?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      className={`h-12 w-full px-3 text-[14px] outline-none rounded-[8px] transition-colors ${
        mono ? "font-mono" : ""
      }`}
      style={{
        background: "var(--field-bg)",
        border: "1px solid var(--field-bg)",
        color: "var(--text-primary)",
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = "var(--border-strong)";
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = "var(--field-bg)";
      }}
    />
  );
}

function UnitInput({
  value,
  onChange,
  unit,
}: {
  value: number;
  onChange: (v: number) => void;
  unit: string;
}) {
  return (
    <div
      className="h-12 w-full flex items-center px-3 rounded-[8px]"
      style={{
        background: "var(--field-bg)",
        border: "1px solid var(--field-bg)",
      }}
    >
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        min={0}
        max={64}
        className="flex-1 bg-transparent outline-none text-[13px]"
        style={{ color: "var(--text-primary)" }}
      />
      <span
        className="text-[12px] px-2 h-7 inline-flex items-center rounded-[6px]"
        style={{
          background: "var(--well)",
          color: "var(--text-tertiary)",
        }}
      >
        {unit}
      </span>
    </div>
  );
}

function HexColorInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div
      className="h-12 w-full flex items-center px-3 rounded-[8px] transition-colors"
      style={{
        background: "var(--field-bg)",
        border: "1px solid var(--field-bg)",
      }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent outline-none text-[14px] font-mono"
        style={{ color: "var(--text-primary)" }}
      />
      <label
        className="relative size-5 shrink-0 cursor-pointer rounded-[4px] overflow-hidden"
        style={{
          background: value || "var(--well)",
          border: "1px solid var(--border-strong)",
        }}
      >
        <input
          type="color"
          value={value || "#888888"}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
          onFocus={preventScrollJump}
        />
      </label>
    </div>
  );
}

function SelectInput({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-12 w-full flex items-center justify-between px-3 text-[14px] rounded-[8px] transition-colors"
        style={{
          background: "var(--field-bg)",
          border: "1px solid var(--field-bg)",
          color: selected ? "var(--text-primary)" : "var(--text-placeholder)",
        }}
      >
        <span className="truncate">
          {selected?.label ?? placeholder ?? "Select"}
        </span>
        <ChevronDownIcon open={open} />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 mt-1 z-50 py-1 max-h-64 overflow-y-auto rounded-[10px]"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          {options.map((o) => {
            const isActive = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className="flex items-center w-full px-3 h-9 text-[13px] transition-colors"
                style={{
                  color: isActive
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
                  background: isActive ? "var(--well)" : "transparent",
                  fontWeight: isActive ? 500 : 400,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--well)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = isActive
                    ? "var(--well)"
                    : "transparent")
                }
              >
                {o.label}
                {isActive && (
                  <span className="ml-auto">
                    <CheckIcon />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
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
      className="relative w-[34px] h-[20px] rounded-full transition-colors shrink-0"
      style={{
        background: checked ? "var(--accent)" : "var(--switch-off-bg)",
      }}
    >
      <span
        className="absolute top-[3px] left-[3px] size-[14px] rounded-full transition-transform"
        style={{
          background: "var(--switch-thumb)",
          transform: checked ? "translateX(14px)" : "translateX(0)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
        }}
      />
    </button>
  );
}

function ToggleRow({
  label,
  tooltip,
  checked,
  onChange,
}: {
  label: string;
  tooltip?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between h-7">
      <div className="flex items-center gap-1.5">
        <span
          className="text-[13px] font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {label}
        </span>
        {tooltip && <InfoIcon tooltip={tooltip} />}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Code card (flip back-face)
   ───────────────────────────────────────────────────────────── */

function CodeCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    });
  }, [code]);

  return (
    // The dark-mode modal container with the snippet inside — always dark
    // regardless of the page theme, per the Figma code-view design
    // (modal/background #0a0a0a, modal/border #18181b, rounded-4 = 16px).
    <div
      className="w-full h-full flex flex-col gap-2 rounded-[16px] p-4"
      style={{
        background: "#0a0a0a",
        border: "1px solid #18181b",
        boxShadow: "var(--shadow-widget)",
        minHeight: 520,
      }}
    >
      <pre
        className="flex-1 m-0 rounded-[8px] px-6 py-4 font-mono font-medium text-[12px] leading-[normal] overflow-auto whitespace-pre-wrap break-words"
        style={{
          background: "#18181b",
          color: "#9f9fa9",
        }}
      >
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={copy}
        className="w-full h-11 shrink-0 inline-flex items-center justify-center gap-3 text-[14px] font-medium rounded-[8px] transition-colors"
        style={{
          background: "#e4e4e7",
          color: "#09090b",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#d4d4d8")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#e4e4e7")}
      >
        {copied ? (
          <>
            <CheckIcon size={16} />
            Copied
          </>
        ) : (
          <>
            <CopyIcon size={16} />
            Copy code
          </>
        )}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Code generation
   ───────────────────────────────────────────────────────────── */

function buildModalCodeString(cfg: {
  targetChain: number | "solana";
  targetToken: string;
  recipient: string;
  ownerAddress: string;
  rhinestoneApiKey?: string;
  themeMode: "light" | "dark";
  radiusToken: "none" | "sm" | "md" | "lg";
  prefilledAmount: string;
  sessionChainIds?: number[];
  ctaColor: string;
  fontColor: string;
  iconColor: string;
  backgroundColor: string;
  showHistoryButton: boolean;
  maxDeposit?: number;
  minDeposit?: number;
}): string {
  const lines: string[] = [
    `import { DepositModal } from "@rhinestone/deposit-modal";`,
    `import "@rhinestone/deposit-modal/styles.css";`,
    ``,
    `<DepositModal`,
    `  isOpen={isOpen}`,
    `  onClose={() => setIsOpen(false)}`,
    cfg.targetChain === "solana"
      ? `  targetChain="solana"`
      : `  targetChain={${cfg.targetChain}}`,
    `  targetToken="${cfg.targetToken}"`,
  ];
  if (cfg.ownerAddress) lines.push(`  dappAddress="${cfg.ownerAddress}"`);
  if (cfg.recipient) lines.push(`  recipient="${cfg.recipient}"`);
  if (cfg.prefilledAmount)
    lines.push(`  defaultAmount="${cfg.prefilledAmount}"`);
  if (cfg.sessionChainIds?.length)
    lines.push(`  sessionChainIds={[${cfg.sessionChainIds.join(", ")}]}`);
  if (cfg.rhinestoneApiKey)
    lines.push(`  rhinestoneApiKey="${cfg.rhinestoneApiKey}"`);
  lines.push(`  theme={{`);
  lines.push(`    mode: "${cfg.themeMode}",`);
  lines.push(`    radius: "${cfg.radiusToken}",`);
  if (cfg.fontColor) lines.push(`    fontColor: "${cfg.fontColor}",`);
  if (cfg.iconColor) lines.push(`    iconColor: "${cfg.iconColor}",`);
  if (cfg.ctaColor) lines.push(`    ctaColor: "${cfg.ctaColor}",`);
  if (cfg.backgroundColor)
    lines.push(`    backgroundColor: "${cfg.backgroundColor}",`);
  lines.push(`  }}`);
  if (
    cfg.showHistoryButton ||
    cfg.maxDeposit !== undefined ||
    cfg.minDeposit !== undefined
  ) {
    lines.push(`  uiConfig={{`);
    if (cfg.showHistoryButton) lines.push(`    showHistoryButton: true,`);
    if (cfg.maxDeposit !== undefined)
      lines.push(`    maxDepositUsd: ${cfg.maxDeposit},`);
    if (cfg.minDeposit !== undefined)
      lines.push(`    minDepositUsd: ${cfg.minDeposit},`);
    lines.push(`  }}`);
  }
  lines.push(`  onLifecycle={(event) => console.log(event.type, event)}`);
  lines.push(`/>`);
  return lines.join("\n");
}

/* ─────────────────────────────────────────────────────────────
   Icons
   ───────────────────────────────────────────────────────────── */

function RhinestoneWordmark() {
  return (
    <svg
      viewBox="0 0 153 34"
      fill="none"
      aria-label="Rhinestone"
      role="img"
      style={{ height: 22, width: "auto", color: "var(--text-primary)" }}
    >
      <g clipPath="url(#rh-clip)">
        <path
          opacity="0.5"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M22.2631 31.4818C20.8401 32.5897 19.217 33.4962 17.1864 33.619C16.8209 33.6412 16.4545 33.6411 16.0891 33.619C14.0585 33.4962 12.4353 32.5897 11.0124 31.4818C9.69078 30.4528 8.23999 29.0018 6.5894 27.351C6.54365 27.3053 6.49775 27.2594 6.45169 27.2133C6.40563 27.1673 6.35973 27.1214 6.31397 27.0756C4.66316 25.425 3.21217 23.9743 2.18317 22.6527C1.07527 21.2297 0.168761 19.6066 0.0459294 17.576C0.023826 17.2106 0.023826 16.8441 0.0459294 16.4787C0.168761 14.4481 1.07527 12.825 2.18317 11.402C3.21217 10.0804 4.66316 8.62965 6.31397 6.97907C6.35973 6.93332 6.40563 6.88742 6.45169 6.84136C6.49775 6.79531 6.54365 6.7494 6.5894 6.70365C8.23999 5.05284 9.69078 3.60187 11.0124 2.57287C12.4353 1.46498 14.0585 0.558472 16.0891 0.435642C16.4545 0.413538 16.8209 0.413537 17.1864 0.435641C19.217 0.558472 20.8401 1.46498 22.2631 2.57287C23.5847 3.60187 25.0355 5.05285 26.6861 6.70366C26.7318 6.74941 26.7777 6.79531 26.8238 6.84136C26.8698 6.88742 26.9157 6.93332 26.9615 6.97906C28.6123 8.62964 30.0633 10.0804 31.0923 11.402C32.2002 12.825 33.1067 14.4481 33.2295 16.4787C33.2516 16.8441 33.2516 17.2106 33.2295 17.576C33.1067 19.6066 32.2002 21.2297 31.0923 22.6527C30.0633 23.9743 28.6123 25.425 26.9615 27.0756C26.9157 27.1214 26.8698 27.1673 26.8238 27.2133C26.7777 27.2594 26.7318 27.3053 26.6861 27.351C25.0355 29.0018 23.5847 30.4528 22.2631 31.4818ZM3.36415 17.3752C3.49609 19.5565 5.26483 21.3253 8.80232 24.8627C12.3398 28.4002 14.1085 30.1689 16.2898 30.3008C16.5216 30.3149 16.7539 30.3149 16.9856 30.3008C19.1669 30.1689 20.9357 28.4002 24.4731 24.8627C28.0106 21.3253 29.7794 19.5565 29.9113 17.3752C29.9253 17.1435 29.9253 16.9112 29.9113 16.6794C29.7794 14.4982 28.0106 12.7294 24.4731 9.19197C20.9357 5.65451 19.1669 3.88578 16.9856 3.75384C16.7539 3.73982 16.5216 3.73982 16.2898 3.75384C14.1085 3.88578 12.3398 5.65451 8.80232 9.19198C5.26483 12.7294 3.49609 14.4982 3.36415 16.6794C3.35013 16.9112 3.35013 17.1435 3.36415 17.3752Z"
          fill="currentColor"
        />
        <path
          d="M7.77344 17.0249C7.77344 16.6627 8.02966 16.353 8.38185 16.2688C10.1682 15.8416 11.5749 15.173 12.756 14.1267C13.1035 13.8188 13.4321 13.4902 13.74 13.1426C14.7863 11.9616 15.4549 10.5549 15.8821 8.76856C15.9663 8.41638 16.2761 8.16016 16.6382 8.16016C17.0003 8.16016 17.3101 8.41637 17.3943 8.76856C17.8215 10.5549 18.4901 11.9616 19.5364 13.1427C19.8443 13.4902 20.1729 13.8188 20.5204 14.1267C21.7015 15.173 23.1082 15.8416 24.8946 16.2688C25.2467 16.353 25.503 16.6627 25.503 17.0249C25.503 17.387 25.2467 17.6967 24.8946 17.781C23.1082 18.2082 21.7015 18.8767 20.5204 19.9231C20.1729 20.2309 19.8443 20.5595 19.5364 20.9071C18.4901 22.0881 17.8215 23.4948 17.3943 25.2812C17.3101 25.6334 17.0003 25.8896 16.6382 25.8896C16.2761 25.8896 15.9663 25.6334 15.8821 25.2812C15.4549 23.4948 14.7863 22.0881 13.74 20.9071C13.4321 20.5595 13.1035 20.2309 12.756 19.9231C11.5749 18.8767 10.1682 18.2082 8.38185 17.781C8.02966 17.6967 7.77344 17.387 7.77344 17.0249Z"
          fill="currentColor"
        />
      </g>
      <path d="M64.002 9.71077C64.002 10.7986 64.8193 11.5692 66.0451 11.5692C67.271 11.5692 68.0655 10.7986 68.0655 9.71077C68.0655 8.60024 67.271 7.875 66.0451 7.875C64.8193 7.875 64.002 8.60024 64.002 9.71077Z" fill="currentColor" />
      <path d="M64.4107 12.7704V24.1023H67.6796V12.7704H64.4107Z" fill="currentColor" />
      <path d="M55.062 24.1023H51.793V8.23762H55.062V14.5835C55.5841 13.4956 56.7646 12.4304 58.4445 12.4304C61.1913 12.4304 62.4399 14.1982 62.4399 17.2805V24.1023H59.1709V17.6431C59.1709 16.0113 58.4445 15.1728 57.1959 15.1728C55.7884 15.1728 55.062 16.306 55.062 17.9378V24.1023Z" fill="currentColor" />
      <path d="M45.6205 24.1023H42.3516V12.7704H45.6205L45.0449 15.3703C45.0107 15.5249 45.1283 15.6714 45.2866 15.6714V15.6714C45.4022 15.6714 45.5018 15.591 45.5321 15.4794C46.0193 13.6887 47.49 12.5891 49.003 12.5891C49.5932 12.5891 49.9564 12.6344 50.2061 12.6797V15.694C49.9791 15.6714 49.23 15.6261 48.7987 15.6261C47.3685 15.6261 45.6205 16.2833 45.6205 19.8642V24.1023Z" fill="currentColor" />
      <path d="M73.2334 24.1023H69.9645V12.7704H73.2334L73.188 14.6742C73.7101 13.5636 74.936 12.4304 76.6159 12.4304C79.3627 12.4304 80.6113 14.1982 80.6113 17.2805V24.1023H77.3423V17.6431C77.3423 16.0113 76.6159 15.1728 75.3673 15.1728C73.9599 15.1728 73.2334 16.306 73.2334 17.9378V24.1023Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M82.313 18.459C82.313 21.9266 84.4696 24.465 88.0791 24.465C91.2799 24.465 92.9825 22.7198 93.4819 20.7934L90.44 20.2268C90.2357 21.0201 89.4411 21.9719 88.0564 21.9719C86.6262 21.9719 85.4457 20.7028 85.423 19.1843H93.5046C93.5727 18.9123 93.6181 18.527 93.6181 18.0058C93.6181 14.7195 91.1664 12.4078 88.1018 12.4078C84.9009 12.4078 82.313 14.9688 82.313 18.459ZM90.44 17.2352H85.5365C85.6046 15.83 86.7624 14.8328 88.0564 14.8328C89.3276 14.8328 90.4854 15.7847 90.44 17.2352Z" fill="currentColor" />
      <path d="M100.091 24.465C97.5261 24.465 95.1425 23.5811 94.6658 20.9521L97.7077 20.4988C98.0709 21.6773 98.8882 22.1759 100.046 22.1759C101.113 22.1759 101.68 21.6773 101.68 21.0201C101.68 20.4535 101.249 20.0682 100.091 19.8415L99.0244 19.6149C96.7089 19.139 95.256 18.0738 95.256 16.1926C95.256 13.9489 97.2083 12.4078 100.046 12.4078C102.725 12.4078 104.7 13.6543 104.972 15.9887L101.976 16.442C101.839 15.3314 101.067 14.6968 100.046 14.6968C99.0017 14.6968 98.4568 15.2634 98.4568 15.9207C98.4568 16.4419 98.8201 16.8046 99.7962 17.0085L100.863 17.2125C103.565 17.7565 104.972 18.8443 104.972 20.9294C104.972 23.0825 102.793 24.465 100.091 24.465Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M115.69 18.4364C115.69 21.7 117.983 24.465 121.592 24.465C125.202 24.465 127.517 21.7 127.517 18.4364C127.517 15.1501 125.202 12.4078 121.592 12.4078C117.983 12.4078 115.69 15.1501 115.69 18.4364ZM124.225 18.4364C124.225 20.5215 122.977 21.5187 121.592 21.5187C120.23 21.5187 118.981 20.5215 118.981 18.4364C118.981 16.374 120.23 15.3314 121.592 15.3314C122.977 15.3314 124.225 16.3513 124.225 18.4364Z" fill="currentColor" />
      <path d="M132.615 24.1023H129.347V12.7704H132.615L132.57 14.6742C133.092 13.5636 134.318 12.4304 135.998 12.4304C138.745 12.4304 139.993 14.1982 139.993 17.2805V24.1023H136.724V17.6431C136.724 16.0113 135.998 15.1728 134.749 15.1728C133.342 15.1728 132.615 16.306 132.615 17.9378V24.1023Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M141.695 18.459C141.695 21.9266 143.852 24.465 147.461 24.465C150.662 24.465 152.365 22.7198 152.864 20.7934L149.822 20.2268C149.618 21.0201 148.823 21.9719 147.438 21.9719C146.008 21.9719 144.828 20.7028 144.805 19.1843H152.887C152.955 18.9123 153 18.527 153 18.0058C153 14.7195 150.548 12.4078 147.484 12.4078C144.283 12.4078 141.695 14.9688 141.695 18.459ZM149.822 17.2352H144.919C144.987 15.83 146.144 14.8328 147.438 14.8328C148.71 14.8328 149.867 15.7847 149.822 17.2352Z" fill="currentColor" />
      <path d="M111.439 19.2284V15.4317H114.682V12.7501H111.439V9.39258H108.189V12.7501H105.834V15.4317H108.189L108.189 19.0361C108.189 19.054 108.189 19.0726 108.189 19.0918C108.189 19.1712 108.189 19.357 108.189 19.357C108.189 19.6677 108.172 20.0467 108.219 20.399C108.3 20.9983 108.535 21.9684 109.372 22.8036C110.208 23.6387 111.18 23.8733 111.78 23.9538C112.246 24.0163 112.764 24.0155 113.092 24.0149L114.483 24.0177V20.9718H113.169C112.346 20.9718 111.934 20.9718 111.678 20.7165C111.438 20.4762 111.438 20.0981 111.439 19.3693C111.439 19.3237 111.439 19.2768 111.439 19.2284Z" fill="currentColor" />
      <defs>
        <clipPath id="rh-clip">
          <rect width="34" height="34" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function ArrowUpRightIcon() {
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
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );
}

function ArrowLeftIcon() {
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
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
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

function CopyIcon({ size = 11 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function CheckIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 transition-transform"
      style={{
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        color: "#9f9fa9",
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
      <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
      <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function InfoIcon({ tooltip }: { tooltip: string }) {
  return (
    <span className="relative inline-flex group/info">
      <span
        className="inline-flex items-center justify-center size-[14px] rounded-full text-[9px] font-bold"
        style={{
          background: "var(--well)",
          color: "var(--text-tertiary)",
        }}
      >
        i
      </span>
      <span
        className="absolute left-0 top-full mt-1.5 z-10 w-52 p-2 text-[11px] leading-snug opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-opacity"
        style={{
          background: "var(--surface)",
          color: "var(--text-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          boxShadow: "var(--shadow-md)",
          fontWeight: 400,
        }}
      >
        {tooltip}
      </span>
    </span>
  );
}
