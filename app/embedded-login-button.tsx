"use client";

import { usePrivy } from "@privy-io/react-auth";

export function EmbeddedLoginButton() {
  const { ready, authenticated, login, logout, user } = usePrivy();

  if (!ready) {
    return (
      <span
        className="text-[12px] font-medium px-2.5 py-1.5"
        style={{ color: "var(--text-tertiary)" }}
      >
        Loading Privy...
      </span>
    );
  }

  if (authenticated) {
    const embeddedWallet = user?.linkedAccounts?.find(
      (a) => a.type === "wallet" && a.walletClientType === "privy",
    );
    const addr =
      embeddedWallet && "address" in embeddedWallet
        ? embeddedWallet.address
        : null;
    const truncated = addr
      ? `${addr.slice(0, 6)}...${addr.slice(-4)}`
      : "Logged in";

    return (
      <button
        onClick={() => logout()}
        className="flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 transition-colors"
        style={{
          background: "var(--bg-surface)",
          color: "var(--text-secondary)",
          borderRadius: "var(--radius-sm)",
        }}
      >
        <span
          className="size-2 rounded-full"
          style={{ background: "#30a46c" }}
        />
        <span>{truncated}</span>
        <span style={{ color: "var(--text-tertiary)" }}>·</span>
        <span style={{ color: "var(--text-error, #e5484d)" }}>Logout</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => login()}
      className="flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 transition-colors"
      style={{
        background: "var(--bg-accent)",
        color: "white",
        borderRadius: "var(--radius-sm)",
      }}
    >
      Privy Login
    </button>
  );
}
