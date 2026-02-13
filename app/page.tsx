"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  lazy,
  Suspense,
} from "react";
import {
  DepositModal,
  WithdrawModal,
  NATIVE_TOKEN_ADDRESS,
  SOURCE_CHAINS,
  getTokenAddress,
  getSupportedTokenSymbolsForChain,
} from "@rhinestone/deposit-modal";
import type { WithdrawSignParams } from "@rhinestone/deposit-modal";
import { isAddress, type Address, type Hex } from "viem";
import { useEmbeddedMode } from "./providers";

type FlowMode = "deposit" | "withdraw";

const DEFAULT_RECIPIENT = "0x0197d7FaFCA118Bc91f6854B9A2ceea94E676585";

const MAINNET_CHAIN_IDS = new Set([1, 8453, 42161, 10, 137, 56]);

function getSelectableSymbolsForChain(chainId: number): string[] {
  return getSupportedTokenSymbolsForChain(chainId).filter((symbol) => {
    if (symbol.toUpperCase() === "ETH") return true;
    return Boolean(getTokenAddress(symbol, chainId));
  });
}

const CHAIN_OPTIONS = SOURCE_CHAINS.filter(
  (chain) =>
    MAINNET_CHAIN_IDS.has(chain.id) &&
    getSelectableSymbolsForChain(chain.id).length > 0,
).map((chain) => ({
  id: chain.id,
  label: chain.name,
}));

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
  { label: "Default", value: "" },
  { label: "Blue", value: "#0090ff" },
  { label: "Indigo", value: "#6e56cf" },
  { label: "Emerald", value: "#30a46c" },
  { label: "Rose", value: "#e5484d" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Neutral", value: "#18181b" },
];

function resolveTokenAddress(chainId: number, symbol: string): string {
  if (symbol.toUpperCase() === "ETH") return NATIVE_TOKEN_ADDRESS;
  return getTokenAddress(symbol, chainId) ?? NATIVE_TOKEN_ADDRESS;
}

function tokenForChain(chainId: number): string {
  const symbol = getSelectableSymbolsForChain(chainId)[0] ?? "USDC";
  return resolveTokenAddress(chainId, symbol);
}

function symbolForToken(chainId: number, token: string): string {
  if (token.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()) return "ETH";
  const symbols = getSelectableSymbolsForChain(chainId);
  const matched = symbols.find(
    (symbol) =>
      resolveTokenAddress(chainId, symbol).toLowerCase() ===
      token.toLowerCase(),
  );
  return matched ?? symbols[0] ?? "USDC";
}

const LazyEmbeddedWithdrawHandler = lazy(() =>
  import("./embedded-withdraw-handler").then((m) => ({
    default: m.EmbeddedWithdrawHandler,
  })),
);

const LazyEmbeddedLoginButton = lazy(() =>
  import("./embedded-login-button").then((m) => ({
    default: m.EmbeddedLoginButton,
  })),
);

export default function Home() {
  const [flow, setFlow] = useState<FlowMode>("deposit");
  const [targetChain, setTargetChain] = useState(8453);
  const [targetToken, setTargetToken] = useState(tokenForChain(8453));
  const [sourceChain, setSourceChain] = useState(8453);
  const [sourceToken, setSourceToken] = useState(tokenForChain(8453));
  const [safeAddress, setSafeAddress] = useState("");
  const [accent, setAccent] = useState("");
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");
  const [borderRadius, setBorderRadius] = useState(14);
  const [brandTitle, setBrandTitle] = useState("Deposit");
  const [logoUrl, setLogoUrl] = useState(
    "https://github.com/rhinestonewtf.png",
  );

  // UI Config
  const [showLogo, setShowLogo] = useState(false);
  const [showStepper, setShowStepper] = useState(false);
  const [balanceTitle, setBalanceTitle] = useState("Nexus balance");
  const [maxDepositUsd, setMaxDepositUsd] = useState<number | undefined>(100);
  const [minDepositUsd, setMinDepositUsd] = useState<number | undefined>(undefined);

  // Theme colors
  const [fontColor, setFontColor] = useState("");
  const [iconColor, setIconColor] = useState("");
  const [ctaHoverColor, setCtaHoverColor] = useState("");
  const [borderColor, setBorderColor] = useState("");
  const [backgroundColor, setBackgroundColor] = useState("");

  const [recipient, setRecipient] = useState(DEFAULT_RECIPIENT);
  const [prefilledAmount, setPrefilledAmount] = useState("");
  const [waitForFinalTx, setWaitForFinalTx] = useState(false);
  const [useCustomSessionChains, setUseCustomSessionChains] = useState(false);
  const [customSessionChainIds, setCustomSessionChainIds] = useState<number[]>([
    8453, 42161, 10,
  ]);
  const [showCode, setShowCode] = useState(false);
  const [showModal, setShowModal] = useState(true);

  const { isEmbedded, embeddedAddress, privyAvailable, requestLogin } =
    useEmbeddedMode();
  const withdrawSignRef = useRef<
    ((params: WithdrawSignParams) => Promise<{ txHash: Hex }>) | null
  >(null);

  const reownProjectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;
  const rhinestoneApiKey = process.env.NEXT_PUBLIC_RHINESTONE_API_KEY;
  const withdrawReownAppId = isEmbedded ? undefined : reownProjectId;

  const handleWithdrawSign = useCallback(
    async (params: WithdrawSignParams): Promise<{ txHash: Hex }> => {
      if (!withdrawSignRef.current) {
        throw new Error("Privy embedded wallet not available");
      }
      return withdrawSignRef.current(params);
    },
    [],
  );

  const handleChainChange = useCallback(
    (chainId: number) => {
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

  const handleSourceChainChange = useCallback(
    (chainId: number) => {
      const nextSymbols = getSelectableSymbolsForChain(chainId);
      if (nextSymbols.length === 0) return;
      const previousSymbol = symbolForToken(sourceChain, sourceToken);
      const nextSymbol = nextSymbols.includes(previousSymbol)
        ? previousSymbol
        : nextSymbols[0];
      setSourceChain(chainId);
      setSourceToken(resolveTokenAddress(chainId, nextSymbol));
    },
    [sourceChain, sourceToken],
  );

  const onDepositComplete = useCallback(
    (d: unknown) => console.log("complete", d),
    [],
  );
  const onError = useCallback((e: unknown) => console.log("error", e), []);

  const availableSessionChainIds = useMemo(
    () => CHAIN_OPTIONS.map((chain) => chain.id),
    [],
  );

  const sessionChainIds = useMemo(() => {
    if (!useCustomSessionChains) {
      return undefined;
    }
    const allowed = new Set(availableSessionChainIds);
    const filtered = customSessionChainIds.filter((chainId) =>
      allowed.has(chainId),
    );
    if (filtered.length > 0) {
      return filtered;
    }
    return [targetChain];
  }, [
    useCustomSessionChains,
    availableSessionChainIds,
    customSessionChainIds,
    targetChain,
  ]);

  const toggleSessionChain = useCallback((chainId: number) => {
    setCustomSessionChainIds((prev) =>
      prev.includes(chainId)
        ? prev.filter((id) => id !== chainId)
        : [...prev, chainId],
    );
  }, []);

  const componentKey = `${flow}-${targetChain}-${targetToken}-${sourceChain}-${sourceToken}-${safeAddress}-${recipient}-${themeMode}-${accent}-${borderRadius}-${brandTitle}-${logoUrl}-${prefilledAmount}-${waitForFinalTx}-${useCustomSessionChains}-${customSessionChainIds.join(",")}-${showLogo}-${showStepper}-${balanceTitle}-${maxDepositUsd}-${minDepositUsd}-${fontColor}-${iconColor}-${ctaHoverColor}-${borderColor}-${backgroundColor}-${isEmbedded}-${embeddedAddress ?? ""}`;

  const recipientTooltip =
    flow === "withdraw"
      ? "The address that will receive withdrawn funds on the destination chain."
      : "The address where deposited funds are sent. Set this to the user's address when installing the widget.";

  const isSafeAddressValid =
    flow !== "withdraw" ||
    (safeAddress.length > 0 && isAddress(safeAddress, { strict: false }));

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {isEmbedded && (
        <Suspense fallback={null}>
          <LazyEmbeddedWithdrawHandler signRef={withdrawSignRef} />
        </Suspense>
      )}
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
            {flow === "withdraw" ? "Withdraw" : "Deposit"} Modal
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
          {privyAvailable && (
            <Suspense fallback={null}>
              <LazyEmbeddedLoginButton />
            </Suspense>
          )}
          <a
            href="https://docs.google.com/document/d/1uaOrXAEALpuXsn-jIdTI-DGIichypdeGSUpkE_qNruo/edit?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[12px] font-medium transition-colors"
            style={{ color: "var(--text-tertiary)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--text-secondary)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-tertiary)")
            }
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
            <Section title="Mode">
              <Row label="Flow">
                <Pill
                  value={flow}
                  onChange={(v) => {
                    setFlow(v as FlowMode);
                    setBrandTitle(v === "withdraw" ? "Withdraw" : "Deposit");
                  }}
                  options={[
                    { value: "deposit", label: "Deposit" },
                    { value: "withdraw", label: "Withdraw" },
                  ]}
                />
              </Row>
              <Row label="Show Modal">
                <Toggle checked={showModal} onChange={setShowModal} />
              </Row>
            </Section>

            {flow === "withdraw" && (
              <Section title="Source (Safe)">
                <Row label="Safe address">
                  <input
                    type="text"
                    value={safeAddress}
                    onChange={(e) => setSafeAddress(e.target.value.trim())}
                    placeholder="0x..."
                    className="text-[13px] font-mono bg-transparent outline-none text-right w-35 text-ellipsis overflow-hidden"
                    style={{ color: "var(--text-primary)" }}
                  />
                </Row>
                <Row label="Chain">
                  <Select
                    value={String(sourceChain)}
                    onChange={(v) => handleSourceChainChange(Number(v))}
                    options={CHAIN_OPTIONS.map((chain) => ({
                      value: String(chain.id),
                      label: chain.label,
                    }))}
                  />
                </Row>
                <Row label="Token">
                  <Select
                    value={symbolForToken(sourceChain, sourceToken)}
                    onChange={(value) =>
                      setSourceToken(resolveTokenAddress(sourceChain, value))
                    }
                    options={getSelectableSymbolsForChain(sourceChain).map(
                      (symbol) => ({
                        value: symbol,
                        label: symbol,
                      }),
                    )}
                  />
                </Row>
              </Section>
            )}

            {/* Target */}
            <Section title="Destination">
              <Row label="Chain">
                <Select
                  value={String(targetChain)}
                  onChange={(v) => handleChainChange(Number(v))}
                  options={CHAIN_OPTIONS.map((chain) => ({
                    value: String(chain.id),
                    label: chain.label,
                  }))}
                />
              </Row>
              <Row label="Token">
                <Select
                  value={symbolForToken(targetChain, targetToken)}
                  onChange={(value) =>
                    setTargetToken(resolveTokenAddress(targetChain, value))
                  }
                  options={getSelectableSymbolsForChain(targetChain).map(
                    (symbol) => ({
                      value: symbol,
                      label: symbol,
                    }),
                  )}
                />
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
              <Row
                label={
                  <LabelWithInfo text="Recipient" tooltip={recipientTooltip} />
                }
              >
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="0x..."
                  className="text-[13px] font-mono bg-transparent outline-none text-right w-27.5 text-ellipsis overflow-hidden"
                  style={{ color: "var(--text-primary)" }}
                />
              </Row>
              <Row
                label={
                  <LabelWithInfo
                    text="Wait for final tx"
                    tooltip="For faster transaction confirmation, Rhinestone marks an intent as complete when the solver delivers a pre-confirmation."
                  />
                }
              >
                <Toggle checked={waitForFinalTx} onChange={setWaitForFinalTx} />
              </Row>
            </Section>

            <Section title="Session Signing">
              <Row
                label={
                  <LabelWithInfo
                    text="Scope"
                    tooltip="Auto uses modal defaults. Custom signs sessions only for selected chains, plus the target chain."
                  />
                }
              >
                <Pill
                  value={useCustomSessionChains ? "custom" : "auto"}
                  onChange={(value) =>
                    setUseCustomSessionChains(value === "custom")
                  }
                  options={[
                    { value: "auto", label: "Auto" },
                    { value: "custom", label: "Custom" },
                  ]}
                />
              </Row>
              {useCustomSessionChains && (
                <div className="p-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {CHAIN_OPTIONS.map((chain) => {
                      const selected = customSessionChainIds.includes(chain.id);
                      return (
                        <button
                          key={chain.id}
                          type="button"
                          onClick={() => toggleSessionChain(chain.id)}
                          className="px-2 py-1 text-[11px] font-medium transition-colors"
                          style={{
                            borderRadius: "var(--radius-full)",
                            border: "1px solid var(--border-surface)",
                            background: selected
                              ? "var(--bg-accent)"
                              : "var(--bg-surface)",
                            color: selected ? "white" : "var(--text-secondary)",
                          }}
                        >
                          {chain.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
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
                      key={p.value || "default"}
                      type="button"
                      onClick={() => setAccent(p.value)}
                      title={p.label}
                      className="size-4.5 rounded-full shrink-0 transition-all"
                      style={{
                        background: p.value || "var(--bg-surface)",
                        border: !p.value
                          ? "1.5px solid var(--border-surface)"
                          : "none",
                        boxShadow:
                          accent === p.value
                            ? `0 0 0 1.5px var(--bg-primary), 0 0 0 3px ${p.value || "var(--text-tertiary)"}`
                            : "none",
                        transform:
                          accent === p.value ? "scale(1.15)" : "scale(1)",
                      }}
                    />
                  ))}
                  <label
                    className="relative size-4.5 rounded-full shrink-0 flex items-center justify-center cursor-pointer transition-colors"
                    style={{ border: "1.5px dashed var(--border-surface)" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor =
                        "var(--text-tertiary)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor =
                        "var(--border-surface)")
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
                    className="text-[11px] font-mono w-6.5 text-right tabular-nums"
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
                  className="text-[13px] font-medium bg-transparent outline-none text-right w-27.5 text-ellipsis overflow-hidden"
                  style={{ color: "var(--text-primary)" }}
                />
              </Row>
              <Row label="Font Color">
                <ColorInput
                  value={fontColor}
                  onChange={setFontColor}
                  placeholder="Auto"
                />
              </Row>
              <Row label="Icon Color">
                <ColorInput
                  value={iconColor}
                  onChange={setIconColor}
                  placeholder="Auto"
                />
              </Row>
              <Row label="CTA Hover">
                <ColorInput
                  value={ctaHoverColor}
                  onChange={setCtaHoverColor}
                  placeholder="Auto"
                />
              </Row>
              <Row label="Border Color">
                <ColorInput
                  value={borderColor}
                  onChange={setBorderColor}
                  placeholder="Auto"
                />
              </Row>
              <Row label="Background">
                <ColorInput
                  value={backgroundColor}
                  onChange={setBackgroundColor}
                  placeholder="Auto"
                />
              </Row>
            </Section>

            {/* UI Config */}
            <Section title="UI Config">
              <Row label="Show Logo">
                <Toggle checked={showLogo} onChange={setShowLogo} />
              </Row>
              <Row label="Show Stepper">
                <Toggle checked={showStepper} onChange={setShowStepper} />
              </Row>
              <Row label="Balance Title">
                <input
                  type="text"
                  value={balanceTitle}
                  onChange={(e) => setBalanceTitle(e.target.value)}
                  placeholder="e.g. Rhinestone Balance"
                  className="text-[13px] font-medium bg-transparent outline-none text-right w-27.5 text-ellipsis overflow-hidden"
                  style={{ color: "var(--text-primary)" }}
                />
              </Row>
              <Row label="Max Deposit USD">
                <input
                  type="number"
                  value={maxDepositUsd ?? ""}
                  onChange={(e) =>
                    setMaxDepositUsd(
                      e.target.value ? Number(e.target.value) : undefined,
                    )
                  }
                  placeholder="No limit"
                  className="text-[13px] font-medium bg-transparent outline-none text-right w-20"
                  style={{ color: "var(--text-primary)" }}
                />
              </Row>
              <Row label="Min Deposit USD">
                <input
                  type="number"
                  value={minDepositUsd ?? ""}
                  onChange={(e) =>
                    setMinDepositUsd(
                      e.target.value ? Number(e.target.value) : undefined,
                    )
                  }
                  placeholder="No minimum"
                  className="text-[13px] font-medium bg-transparent outline-none text-right w-20"
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
                  background: showCode
                    ? "var(--bg-surface-hover)"
                    : "var(--bg-surface)",
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
                    flow === "withdraw"
                      ? buildWithdrawCodeString({
                          safeAddress,
                          sourceChain,
                          sourceToken,
                          targetChain,
                          targetToken,
                          recipient,
                          rhinestoneApiKey,
                          themeMode,
                          borderRadius,
                          brandTitle,
                          logoUrl,
                          prefilledAmount,
                          waitForFinalTx,
                          sessionChainIds,
                          showLogo,
                          showStepper,
                          balanceTitle,
                          fontColor,
                          iconColor,
                          ctaColor: accent,
                          ctaHoverColor,
                          borderColor,
                          backgroundColor,
                        })
                      : buildModalCodeString({
                          targetChain,
                          targetToken,
                          recipient,
                          rhinestoneApiKey,
                          themeMode,
                          borderRadius,
                          brandTitle,
                          logoUrl,
                          prefilledAmount,
                          waitForFinalTx,
                          sessionChainIds,
                          showLogo,
                          showStepper,
                          balanceTitle,
                          maxDepositUsd,
                          minDepositUsd,
                          fontColor,
                          iconColor,
                          ctaColor: accent,
                          ctaHoverColor,
                          borderColor,
                          backgroundColor,
                        })
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
            <div
              style={{
                width: 420,
                boxShadow: "var(--shadow-widget)",
                borderRadius: `${borderRadius}px`,
                overflow: "hidden",
              }}
            >
              {showModal ? (
                flow === "withdraw" ? (
                  isSafeAddressValid ? (
                    <WithdrawModal
                      key={componentKey}
                      isOpen={true}
                      onClose={() => setShowModal(false)}
                      dappAddress={embeddedAddress ?? undefined}
                      reownAppId={withdrawReownAppId}
                      onWithdrawSign={
                        isEmbedded ? handleWithdrawSign : undefined
                      }
                      safeAddress={safeAddress as Address}
                      sourceChain={sourceChain}
                      sourceToken={sourceToken as Address}
                      targetChain={targetChain}
                      targetToken={targetToken as Address}
                      recipient={(recipient as Address) || undefined}
                      defaultAmount={prefilledAmount || undefined}
                      forceRegister={true}
                      sessionChainIds={sessionChainIds}
                      waitForFinalTx={waitForFinalTx}
                      theme={{
                        mode: themeMode,
                        radius:
                          borderRadius <= 4
                            ? "sm"
                            : borderRadius <= 10
                              ? "md"
                              : "lg",
                        fontColor: fontColor || undefined,
                        iconColor: iconColor || undefined,
                        ctaColor: accent || undefined,
                        ctaHoverColor: ctaHoverColor || undefined,
                        borderColor: borderColor || undefined,
                        backgroundColor: backgroundColor || undefined,
                      }}
                      branding={{
                        title: brandTitle || undefined,
                        logoUrl: logoUrl || undefined,
                      }}
                      uiConfig={{
                        showLogo,
                        showStepper,
                        balanceTitle: balanceTitle || undefined,
                      }}
                      onRequestConnect={
                        privyAvailable ? requestLogin : undefined
                      }
                      connectButtonLabel="Connect Wallet"
                      onWithdrawComplete={onDepositComplete}
                      onError={onError}
                      inline={true}
                    />
                  ) : (
                    <div
                      className="flex items-center justify-center text-[13px]"
                      style={{ color: "var(--text-tertiary)", height: 500 }}
                    >
                      Enter a valid Safe address to preview withdraw.
                    </div>
                  )
                ) : (
                  <DepositModal
                    key={componentKey}
                    isOpen={true}
                    onClose={() => setShowModal(false)}
                    dappAddress={embeddedAddress ?? undefined}
                    reownAppId={reownProjectId}
                    targetChain={targetChain}
                    targetToken={targetToken as Address}
                    recipient={(recipient as Address) || undefined}
                    defaultAmount={prefilledAmount || undefined}
                    forceRegister={true}
                    sessionChainIds={sessionChainIds}
                    waitForFinalTx={waitForFinalTx}
                    theme={{
                      mode: themeMode,
                      radius:
                        borderRadius <= 4
                          ? "sm"
                          : borderRadius <= 10
                            ? "md"
                            : "lg",
                      fontColor: fontColor || undefined,
                      iconColor: iconColor || undefined,
                      ctaColor: accent || undefined,
                      ctaHoverColor: ctaHoverColor || undefined,
                      borderColor: borderColor || undefined,
                      backgroundColor: backgroundColor || undefined,
                    }}
                    branding={{
                      title: brandTitle || undefined,
                      logoUrl: logoUrl || undefined,
                    }}
                    uiConfig={{
                      showLogo,
                      showStepper,
                      balanceTitle: balanceTitle || undefined,
                      maxDepositUsd,
                      minDepositUsd,
                    }}
                    onRequestConnect={privyAvailable ? requestLogin : undefined}
                    connectButtonLabel="Connect Wallet"
                    onDepositComplete={onDepositComplete}
                    onError={onError}
                    inline={true}
                  />
                )
              ) : (
                <ModalPlaceholder onOpen={() => setShowModal(true)} />
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
        <div
          className="text-[15px] font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          Modal is closed
        </div>
        <div
          className="text-[13px] mt-1"
          style={{ color: "var(--text-secondary)" }}
        >
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
        className="flex items-center justify-center size-3.75 rounded-full shrink-0"
        style={{
          background: "var(--border-surface)",
          color: "var(--text-secondary)",
        }}
      >
        <span
          className="text-[9px] font-bold leading-none"
          style={{ marginTop: "0.5px" }}
        >
          i
        </span>
      </span>
      <div
        className="absolute left-0 top-full mt-1.5 z-10 w-52 p-2 text-[11px] leading-normal font-normal opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-opacity"
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
      className="flex items-center justify-between h-11 px-3.5"
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
  const newLocal = "flex gap-0.5 p-[3px]";
  return (
    <div
      className={newLocal}
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
          className="text-[12px] font-medium px-2.5 py-1.25 transition-all"
          style={{
            borderRadius: "calc(var(--radius-sm) - 2px)",
            background: value === o.value ? "var(--bg-primary)" : "transparent",
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

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
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
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.25 transition-all"
        style={{
          borderRadius: "var(--radius-sm)",
          background: "var(--bg-surface)",
          color: "var(--text-primary)",
        }}
      >
        <span className="truncate max-w-25">{selected?.label ?? value}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 min-w-35 py-1 overflow-hidden"
          style={{
            borderRadius: "var(--radius-sm)",
            background: "var(--bg-primary)",
            border: "1px solid var(--border-primary)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className="flex items-center w-full text-left px-3 py-[7px] text-[12px] font-medium transition-colors"
              style={{
                background:
                  value === o.value ? "var(--bg-surface)" : "transparent",
                color:
                  value === o.value
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--bg-surface)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  value === o.value ? "var(--bg-surface)" : "transparent")
              }
            >
              {o.label}
              {value === o.value && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="ml-auto shrink-0"
                  style={{ color: "var(--bg-accent)" }}
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
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

function ColorInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-[13px] font-medium bg-transparent outline-none text-right w-[80px] text-ellipsis"
        style={{ color: "var(--text-primary)" }}
      />
      <label
        className="relative size-[18px] rounded shrink-0 flex items-center justify-center cursor-pointer overflow-hidden"
        style={{
          background: value || "var(--bg-surface)",
          border: "1px solid var(--border-surface)",
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
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="text-[10px] px-1 py-0.5 rounded"
          style={{
            background: "var(--bg-surface)",
            color: "var(--text-tertiary)",
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

/* ── Code Generation ─────────────────────────────────────── */

function buildModalCodeString(cfg: {
  targetChain: number;
  targetToken: string;
  recipient: string;
  rhinestoneApiKey?: string;
  themeMode: string;
  borderRadius: number;
  brandTitle: string;
  logoUrl: string;
  prefilledAmount: string;
  waitForFinalTx: boolean;
  sessionChainIds?: number[];
  showLogo: boolean;
  showStepper: boolean;
  balanceTitle: string;
  maxDepositUsd?: number;
  minDepositUsd?: number;
  fontColor: string;
  iconColor: string;
  ctaColor: string;
  ctaHoverColor: string;
  borderColor: string;
  backgroundColor: string;
}): string {
  const lines = [
    `import { DepositModal } from "@rhinestone/deposit-modal";`,
    `import "@rhinestone/deposit-modal/styles.css";`,
    ``,
    `// In your component (identity only flow):`,
    `// const dappAddress = embeddedWalletAddress; // optional, enables QR flow`,
    ``,
    `<DepositModal`,
    `  isOpen={isOpen}`,
    `  onClose={() => setIsOpen(false)}`,
    `  dappAddress={dappAddress}`,
    `  targetChain={${cfg.targetChain}}`,
    `  targetToken="${cfg.targetToken}"`,
    `  forceRegister={true}`,
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
  if (cfg.sessionChainIds && cfg.sessionChainIds.length > 0) {
    lines.push(`  sessionChainIds={[${cfg.sessionChainIds.join(", ")}]}`);
  }
  if (cfg.rhinestoneApiKey) {
    lines.push(`  rhinestoneApiKey="${cfg.rhinestoneApiKey}"`);
  }
  // Theme
  lines.push(`  theme={{`);
  lines.push(`    mode: "${cfg.themeMode}",`);
  const radius =
    cfg.borderRadius <= 4 ? "sm" : cfg.borderRadius <= 10 ? "md" : "lg";
  lines.push(`    radius: "${radius}",`);
  if (cfg.fontColor) lines.push(`    fontColor: "${cfg.fontColor}",`);
  if (cfg.iconColor) lines.push(`    iconColor: "${cfg.iconColor}",`);
  if (cfg.ctaColor) lines.push(`    ctaColor: "${cfg.ctaColor}",`);
  if (cfg.ctaHoverColor)
    lines.push(`    ctaHoverColor: "${cfg.ctaHoverColor}",`);
  if (cfg.borderColor) lines.push(`    borderColor: "${cfg.borderColor}",`);
  if (cfg.backgroundColor)
    lines.push(`    backgroundColor: "${cfg.backgroundColor}",`);
  lines.push(`  }}`);
  // Branding
  if (cfg.brandTitle || cfg.logoUrl) {
    lines.push(`  branding={{`);
    if (cfg.brandTitle) lines.push(`    title: "${cfg.brandTitle}",`);
    if (cfg.logoUrl) lines.push(`    logoUrl: "${cfg.logoUrl}",`);
    lines.push(`  }}`);
  }
  // UI Config - only show if non-default values
  const hasUiConfig =
    cfg.showLogo ||
    cfg.showStepper ||
    cfg.balanceTitle ||
    cfg.maxDepositUsd !== undefined ||
    cfg.minDepositUsd !== undefined;
  if (hasUiConfig) {
    lines.push(`  uiConfig={{`);
    if (cfg.showLogo) lines.push(`    showLogo: true,`);
    if (cfg.showStepper) lines.push(`    showStepper: true,`);
    if (cfg.balanceTitle)
      lines.push(`    balanceTitle: "${cfg.balanceTitle}",`);
    if (cfg.maxDepositUsd !== undefined)
      lines.push(`    maxDepositUsd: ${cfg.maxDepositUsd},`);
    if (cfg.minDepositUsd !== undefined)
      lines.push(`    minDepositUsd: ${cfg.minDepositUsd},`);
    lines.push(`  }}`);
  }
  lines.push(`  onDepositComplete={(data) => console.log("Complete", data)}`);
  lines.push(`/>`);
  return lines.join("\n");
}

function buildWithdrawCodeString(cfg: {
  safeAddress: string;
  sourceChain: number;
  sourceToken: string;
  targetChain: number;
  targetToken: string;
  recipient: string;
  rhinestoneApiKey?: string;
  themeMode: string;
  borderRadius: number;
  brandTitle: string;
  logoUrl: string;
  prefilledAmount: string;
  waitForFinalTx: boolean;
  sessionChainIds?: number[];
  showLogo: boolean;
  showStepper: boolean;
  balanceTitle: string;
  fontColor: string;
  iconColor: string;
  ctaColor: string;
  ctaHoverColor: string;
  borderColor: string;
  backgroundColor: string;
}): string {
  const lines = [
    `import { WithdrawModal } from "@rhinestone/deposit-modal";`,
    `import "@rhinestone/deposit-modal/styles.css";`,
    ``,
    `// In your component (identity only flow):`,
    `// const dappAddress = embeddedWalletAddress;`,
    ``,
    `<WithdrawModal`,
    `  isOpen={isOpen}`,
    `  onClose={() => setIsOpen(false)}`,
    `  dappAddress={dappAddress}`,
    `  safeAddress="${cfg.safeAddress}"`,
    `  sourceChain={${cfg.sourceChain}}`,
    `  sourceToken="${cfg.sourceToken}"`,
    `  targetChain={${cfg.targetChain}}`,
    `  targetToken="${cfg.targetToken}"`,
    `  forceRegister={true}`,
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
  if (cfg.sessionChainIds && cfg.sessionChainIds.length > 0) {
    lines.push(`  sessionChainIds={[${cfg.sessionChainIds.join(", ")}]}`);
  }
  if (cfg.rhinestoneApiKey) {
    lines.push(`  rhinestoneApiKey="${cfg.rhinestoneApiKey}"`);
  }
  lines.push(`  theme={{`);
  lines.push(`    mode: "${cfg.themeMode}",`);
  const radius =
    cfg.borderRadius <= 4 ? "sm" : cfg.borderRadius <= 10 ? "md" : "lg";
  lines.push(`    radius: "${radius}",`);
  if (cfg.fontColor) lines.push(`    fontColor: "${cfg.fontColor}",`);
  if (cfg.iconColor) lines.push(`    iconColor: "${cfg.iconColor}",`);
  if (cfg.ctaColor) lines.push(`    ctaColor: "${cfg.ctaColor}",`);
  if (cfg.ctaHoverColor)
    lines.push(`    ctaHoverColor: "${cfg.ctaHoverColor}",`);
  if (cfg.borderColor) lines.push(`    borderColor: "${cfg.borderColor}",`);
  if (cfg.backgroundColor)
    lines.push(`    backgroundColor: "${cfg.backgroundColor}",`);
  lines.push(`  }}`);
  if (cfg.brandTitle || cfg.logoUrl) {
    lines.push(`  branding={{`);
    if (cfg.brandTitle) lines.push(`    title: "${cfg.brandTitle}",`);
    if (cfg.logoUrl) lines.push(`    logoUrl: "${cfg.logoUrl}",`);
    lines.push(`  }}`);
  }
  const hasUiConfig =
    cfg.showLogo ||
    cfg.showStepper ||
    cfg.balanceTitle;
  if (hasUiConfig) {
    lines.push(`  uiConfig={{`);
    if (cfg.showLogo) lines.push(`    showLogo: true,`);
    if (cfg.showStepper) lines.push(`    showStepper: true,`);
    if (cfg.balanceTitle)
      lines.push(`    balanceTitle: "${cfg.balanceTitle}",`);
    lines.push(`  }}`);
  }
  lines.push(`  onWithdrawComplete={(data) => console.log("Complete", data)}`);
  lines.push(`/>`);
  return lines.join("\n");
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
    <svg
      width="10"
      height="10"
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

function CheckIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
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
