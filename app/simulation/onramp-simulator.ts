"use client";

/**
 * Client-side on-ramp simulator.
 *
 * The demo embeds `@rhinestone/deposit-modal` pointed at the prod orchestrator
 * (`DEFAULT_BACKEND_URL`). The modal drives its fiat on-ramp UI by polling two
 * backend endpoints that are normally advanced by Swapped + processor webhooks:
 *
 *   - GET /onramp/swapped/status/:smartAccount  → Swapped order tracker steps
 *   - GET /deposits?account=…&limit=1           → bridge pipeline / success
 *
 * Prod has no dev webhook-injection endpoints (they're gated behind sandbox dev
 * mode), so instead of hitting the backend we mock those polls entirely in the
 * browser: a button panel writes to the module-level store below, and
 * `installOnrampMockFetch` short-circuits the modal's on-ramp requests with
 * synthetic responses while letting every other request pass through to prod.
 *
 * This mirrors the deposit-modal repo's playground (`fireSwappedEvent` /
 * `fireProcessorEvent`) but with no backend. The Swapped iframe uses a signed
 * sandbox URL when server-side sandbox credentials are configured; otherwise it
 * falls back to a local placeholder. No real funds can ever move because the
 * bridge/deposit polls are always synthetic.
 */

import { useSyncExternalStore } from "react";

export type SwappedSimStatus =
  | "payment_pending"
  | "order_completed"
  | "order_broadcasted";

export type ProcessorSimEvent =
  | "deposit-received"
  | "bridge-started"
  | "bridge-complete"
  | "post-bridge-swap-complete"
  | "bridge-failed";

// Source leg mirrors the prod flow: Swapped delivers USDC on Base, the
// processor bridges to the modal's target chain/token.
const SIMULATED_SOURCE_CHAIN_ID = 8453;
const SIMULATED_SOURCE_TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base
const SIMULATED_AMOUNT = "121500000"; // 121.50 USDC, 6 decimals
const SIMULATED_DISPLAY_AMOUNT = "121.5";

// Minimal subset of the processor's DepositRow that the modal consumes — see
// deposit-modal `core/deposit-service.ts` (DepositRow + depositRowToEvent).
interface SimDepositRow {
  id: string;
  chain: string;
  txHash: string;
  token: string;
  amount: string;
  account: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  targetChain: string;
  targetToken: string;
  sourceTxHash: string;
  sourceAmount: string;
  destinationTxHash: string | null;
  destinationAmount: string | null;
  createdAt: string;
  completedAt: string | null;
  errorCode: string | null;
  isSpam: boolean;
}

export interface SimState {
  /** uuid minted when the modal requests a Swapped widget/connect URL; the
   *  status mock echoes it so the modal's `orderId === expectedOrderUuid` check
   *  passes and the tracker mounts. */
  activeOrderUuid: string | null;
  swappedStatus: SwappedSimStatus | null;
  depositRow: SimDepositRow | null;
  lastProcessorEvent: ProcessorSimEvent | null;
  simulatedTxHash: string | null;
  /** Synced from the page so injected rows target the configured destination. */
  targetChainId: number;
  targetToken: string;
}

const INITIAL_STATE: SimState = {
  activeOrderUuid: null,
  swappedStatus: null,
  depositRow: null,
  lastProcessorEvent: null,
  simulatedTxHash: null,
  targetChainId: 42161, // Arbitrum — overwritten by the page on mount
  targetToken: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC on Arbitrum
};

let state: SimState = INITIAL_STATE;
const listeners = new Set<() => void>();

function setState(patch: Partial<SimState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function getSnapshot(): SimState {
  return state;
}

/** React hook for the panel to render against the current simulation state. */
export function useSimState(): SimState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

function randomTxHash(): string {
  return `0x${randomHex(32)}`;
}

function mintUuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Fallback for older browsers without crypto.randomUUID.
  const h = randomHex(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/* ── public actions (called by the button panel + the page) ──────────────── */

/** Keep injected deposit rows pointed at whatever destination the configurator
 *  currently has selected. No-op when unchanged so we don't churn listeners. */
export function setSimTarget(targetChainId: number, targetToken: string): void {
  if (state.targetChainId === targetChainId && state.targetToken === targetToken) {
    return;
  }
  setState({ targetChainId, targetToken });
}

export function fireSwappedEvent(status: SwappedSimStatus): void {
  setState({ swappedStatus: status });
}

function startSimulatedOrder(activeOrderUuid: string): void {
  setState({
    activeOrderUuid,
    swappedStatus: null,
    depositRow: null,
    lastProcessorEvent: null,
    simulatedTxHash: null,
  });
}

export function fireProcessorEvent(type: ProcessorSimEvent): void {
  const txHash = state.simulatedTxHash ?? randomTxHash();
  // DepositRow.status drives the modal's event-type derivation in
  // depositRowToEvent(): pending → deposit-received, processing →
  // bridge-started, completed → post-bridge-swap-complete (the tracker treats
  // it as the terminal bridge-complete and routes to the success screen),
  // failed → bridge-failed (funds received but bridging failed; the tracker
  // marks the bridging step failed and fires the dapp's `failed` lifecycle).
  const completed =
    type === "bridge-complete" || type === "post-bridge-swap-complete";
  const failed = type === "bridge-failed";
  const status = failed
    ? "failed"
    : type === "deposit-received"
      ? "pending"
      : type === "bridge-started"
        ? "processing"
        : "completed";
  const now = new Date().toISOString();
  const row: SimDepositRow = {
    id: txHash,
    chain: `eip155:${SIMULATED_SOURCE_CHAIN_ID}`,
    txHash,
    token: SIMULATED_SOURCE_TOKEN,
    amount: SIMULATED_AMOUNT,
    account: null, // filled from the request's ?account= param at intercept time
    status,
    targetChain: `eip155:${state.targetChainId}`,
    targetToken: state.targetToken,
    sourceTxHash: txHash,
    sourceAmount: SIMULATED_AMOUNT,
    destinationTxHash: completed ? randomTxHash() : null,
    destinationAmount: completed ? SIMULATED_AMOUNT : null,
    createdAt: now,
    completedAt: completed || failed ? now : null,
    errorCode: failed ? "BRIDGE-1" : null,
    isSpam: false,
  };
  setState({ simulatedTxHash: txHash, depositRow: row, lastProcessorEvent: type });
}

/** Clear all simulated state so the next "Pay with Card" starts a fresh order. */
export function resetSimulation(): void {
  setState({
    activeOrderUuid: null,
    swappedStatus: null,
    depositRow: null,
    lastProcessorEvent: null,
    simulatedTxHash: null,
  });
}

/* ── fetch interceptor ───────────────────────────────────────────────────── */

let originalFetch: typeof window.fetch | null = null;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function readJsonBody(
  init: RequestInit | undefined,
  input: RequestInfo | URL,
): Promise<Record<string, unknown> | null> {
  try {
    if (typeof init?.body === "string") {
      return JSON.parse(init.body) as Record<string, unknown>;
    }
    if (input instanceof Request) {
      return (await input.clone().json()) as Record<string, unknown>;
    }
  } catch {
    /* ignore malformed bodies */
  }
  return null;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function requestMethod(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
): string {
  if (init?.method) return init.method.toUpperCase();
  if (input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

async function getSandboxUrl(
  uuid: string,
  smartAccount: string,
  body: Record<string, unknown> | null,
  kind: "widget" | "connect",
): Promise<Record<string, unknown> | null> {
  try {
    const response = await originalFetch?.("/api/swapped-sandbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(body ?? {}),
        uuid,
        smartAccount,
        kind,
      }),
    });
    if (!response?.ok) return null;
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Wrap `window.fetch` so the modal's on-ramp polls resolve against the
 * in-browser simulation state. Idempotent; returns a restore function.
 */
export function installOnrampMockFetch(backendUrl: string): () => void {
  if (typeof window === "undefined") return () => {};
  if (originalFetch) return () => {}; // already installed
  const realFetch = window.fetch.bind(window);
  originalFetch = realFetch;
  const base = backendUrl.replace(/\/$/, "");

  window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    try {
      const url = requestUrl(input);
      if (url.startsWith(base)) {
        const path = url.slice(base.length);
        const method = requestMethod(input, init);

        // Swapped widget / connect URL → mint our own order uuid so our status
        // mock can echo it back. Prefer a real Swapped sandbox URL signed by
        // the local Next API route; fall back to a harmless placeholder when
        // sandbox credentials are not configured.
        if (
          method === "POST" &&
          (path.startsWith("/onramp/swapped/widget-url") ||
            path.startsWith("/onramp/swapped/connect-url"))
        ) {
          const body = await readJsonBody(init, input);
          const smartAccount =
            typeof body?.smartAccount === "string" ? body.smartAccount : "0x0";
          const uuid = mintUuid();
          startSimulatedOrder(uuid);
          const sandbox = await getSandboxUrl(
            uuid,
            smartAccount,
            body,
            path.startsWith("/onramp/swapped/connect-url") ? "connect" : "widget",
          );
          if (sandbox) return jsonResponse(sandbox);
          return jsonResponse({
            ok: true,
            url: "/simulated-onramp.html",
            currencyCode: "ETH",
            sandbox: true,
            externalCustomerId: `${smartAccount}:${uuid}`,
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          });
        }

        // Swapped order status poll → drives the order tracker. Only take over
        // once we're in a simulated order; otherwise pass through to prod.
        if (method === "GET" && path.startsWith("/onramp/swapped/status/")) {
          if (state.activeOrderUuid) {
            if (state.swappedStatus) {
              return jsonResponse({
                ok: true,
                orderId: state.activeOrderUuid,
                status: state.swappedStatus,
                orderCrypto: "USDC",
                orderCryptoAmount: SIMULATED_DISPLAY_AMOUNT,
                transactionId:
                  state.swappedStatus === "order_broadcasted"
                    ? (state.depositRow?.sourceTxHash ?? null)
                    : null,
                receivedAt: new Date().toISOString(),
                paidAmountUsd: 121.5,
                paidAmountEur: null,
                onrampFeeUsd: 1.75,
                paymentMethod: "creditcard",
              });
            }
            // In a sim order but no status fired yet → "no order" so the modal
            // stays on the iframe placeholder.
            return jsonResponse({ ok: false });
          }
          return realFetch(input, init);
        }

        // Deposit status poll → drives the bridge pipeline + success screen.
        // Pass through until a processor event is fired so non-on-ramp paths
        // (e.g. QR transfer) keep seeing real data.
        if (method === "GET" && path.startsWith("/deposits")) {
          if (state.depositRow) {
            let account: string | null = null;
            try {
              account = new URL(url).searchParams.get("account");
            } catch {
              /* ignore */
            }
            const row = account
              ? { ...state.depositRow, account }
              : state.depositRow;
            return jsonResponse({ deposits: [row] });
          }
          return realFetch(input, init);
        }
      }
    } catch {
      // Any interceptor failure falls back to the real network.
    }
    return realFetch(input, init);
  };

  return () => {
    if (originalFetch) {
      window.fetch = originalFetch;
      originalFetch = null;
    }
  };
}
