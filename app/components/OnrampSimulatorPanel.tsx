"use client";

/**
 * Always-visible dev panel that walks the embedded DepositModal through every
 * on-ramp state transition without moving real funds. It writes to the
 * in-browser simulation store (see ../simulation/onramp-simulator) which the
 * installed fetch interceptor reads to answer the modal's on-ramp polls.
 *
 * Mirrors the deposit-modal repo's playground button groups.
 */

import {
  fireProcessorEvent,
  fireSwappedEvent,
  resetSimulation,
  useSimState,
  type ProcessorSimEvent,
  type SwappedSimStatus,
} from "../simulation/onramp-simulator";

const SWAPPED_BUTTONS: ReadonlyArray<readonly [string, SwappedSimStatus]> = [
  ["A · payment_pending", "payment_pending"],
  ["B · order_completed", "order_completed"],
  ["C · order_broadcasted", "order_broadcasted"],
];

const PROCESSOR_BUTTONS: ReadonlyArray<readonly [string, ProcessorSimEvent]> = [
  ["1 · deposit-received", "deposit-received"],
  ["2 · bridge-started", "bridge-started"],
  ["3 · bridge-complete", "bridge-complete"],
  ["3b · post-bridge-swap-complete", "post-bridge-swap-complete"],
];

export function OnrampSimulatorPanel() {
  const state = useSimState();
  const hasOrder = state.activeOrderUuid !== null;

  return (
    <div
      className="w-full max-w-[380px] flex flex-col gap-3 rounded-[16px] p-4 shrink-0"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex flex-col gap-1">
        <span
          className="text-[13px] font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Simulate on-ramp
        </span>
        <span className="text-[11px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
          Mocks the on-ramp webhooks in your browser — no funds move. Open the
          widget → <strong>Pay with Card</strong> (or Fund from Exchange), then
          fire <strong>A</strong> → the bridge buttons in order.
        </span>
      </div>

      <Group label="Swapped order">
        {SWAPPED_BUTTONS.map(([text, status]) => (
          <SimButton
            key={status}
            label={text}
            active={state.swappedStatus === status}
            onClick={() => fireSwappedEvent(status)}
          />
        ))}
      </Group>

      <Group label="Bridge pipeline">
        {PROCESSOR_BUTTONS.map(([text, type]) => (
          <SimButton
            key={type}
            label={text}
            active={state.lastProcessorEvent === type}
            onClick={() => fireProcessorEvent(type)}
          />
        ))}
        <SimButton
          label="✕ bridge-failed"
          variant="danger"
          active={state.lastProcessorEvent === "bridge-failed"}
          onClick={() => fireProcessorEvent("bridge-failed")}
        />
        <SimButton
          label="Reset"
          variant="muted"
          disabled={!hasOrder && state.swappedStatus === null && state.depositRow === null}
          onClick={resetSimulation}
        />
      </Group>

      <div
        className="text-[10px] leading-relaxed rounded-[8px] px-2.5 py-2 font-mono break-all"
        style={{ background: "var(--well)", color: "var(--text-secondary)" }}
      >
        <div>
          order:{" "}
          {hasOrder
            ? `${state.activeOrderKind ?? "active"}${
                state.paymentMethod ? `/${state.paymentMethod}` : ""
              }`
            : "— (pick Pay with Card or Fund from Exchange)"}
        </div>
        <div>swapped: {state.swappedStatus ?? "—"}</div>
        <div>deposit: {state.lastProcessorEvent ?? "—"}</div>
      </div>
    </div>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function SimButton({
  label,
  onClick,
  active = false,
  disabled = false,
  variant = "default",
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  variant?: "default" | "muted" | "danger";
}) {
  const isMuted = variant === "muted";
  const isDanger = variant === "danger";
  const background = isDanger
    ? active
      ? "#dc2626"
      : "transparent"
    : active
      ? "var(--accent)"
      : isMuted
        ? "transparent"
        : "var(--well)";
  const color = isDanger
    ? active
      ? "#ffffff"
      : "#ef4444"
    : active
      ? "#ffffff"
      : isMuted
        ? "var(--text-tertiary)"
        : "var(--text-primary)";
  const border = isDanger
    ? "1px solid #ef4444"
    : isMuted
      ? "1px solid var(--border)"
      : "1px solid transparent";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-2.5 h-7 text-[11px] font-medium rounded-[6px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background, color, border }}
    >
      {label}
    </button>
  );
}
