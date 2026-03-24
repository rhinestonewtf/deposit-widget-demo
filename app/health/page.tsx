"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const HEALTH_URL = "/api/health";

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  8453: "Base",
  42161: "Arbitrum",
  10: "Optimism",
  137: "Polygon",
  56: "BSC",
};

const CHAIN_SHORT: Record<number, string> = {
  1: "ETH",
  8453: "BASE",
  42161: "ARB",
  10: "OP",
  137: "MATIC",
  56: "BSC",
};

const TARGET_GROUPS = [
  { chainId: 9745, label: "Plasma", tag: "USDT0" },
  { chainId: 8453, label: "Base", tag: "USDC" },
] as const;

interface RouteEntry {
  key: string;
  sourceChainId: number;
  sourceTokenSymbol: string;
  sourceToken: string;
  targetChainId: number;
  targetTokenSymbol: string;
  targetToken: string;
  amount: string;
  settlementMode: string;
  healthy: boolean;
  lastCheckedAt: string;
  latencyMs: number;
  errorCode: string | null;
  errorMessage: string | null;
  traceId: string | null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function latencyLevel(ms: number): "good" | "ok" | "slow" | "bad" {
  if (ms < 600) return "good";
  if (ms < 1000) return "ok";
  if (ms < 2000) return "slow";
  return "bad";
}

const LEVEL_COLORS = {
  good: { bg: "rgba(48, 164, 108, 0.10)", text: "#2b9a66", border: "rgba(48, 164, 108, 0.18)" },
  ok: { bg: "rgba(229, 165, 0, 0.08)", text: "#ad7f00", border: "rgba(229, 165, 0, 0.16)" },
  slow: { bg: "rgba(229, 115, 40, 0.08)", text: "#cc6d2e", border: "rgba(229, 115, 40, 0.16)" },
  bad: { bg: "rgba(229, 72, 77, 0.08)", text: "#cd2b31", border: "rgba(229, 72, 77, 0.18)" },
};

const UNHEALTHY_STYLE = {
  bg: "rgba(229, 72, 77, 0.10)",
  text: "#cd2b31",
  border: "rgba(229, 72, 77, 0.25)",
};

export default function HealthPage() {
  const [routes, setRoutes] = useState<RouteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [filter, setFilter] = useState<"all" | "sponsored" | "unsponsored">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(HEALTH_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRoutes(data.routes ?? []);
      setError(null);
      setLastFetch(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    intervalRef.current = setInterval(fetchHealth, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchHealth]);

  const filtered = routes.filter(
    (r) => filter === "all" || r.settlementMode === filter,
  );

  const totalHealthy = routes.filter((r) => r.healthy).length;
  const totalUnhealthy = routes.length - totalHealthy;
  const allLatencies = routes.map((r) => r.latencyMs);
  const avgLatency = allLatencies.length
    ? Math.round(allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length)
    : 0;
  const p95Latency = allLatencies.length
    ? [...allLatencies].sort((a, b) => a - b)[Math.floor(allLatencies.length * 0.95)]
    : 0;
  const maxLatency = allLatencies.length ? Math.max(...allLatencies) : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa" }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes shimmer { from { background-position: -200% 0; } to { background-position: 200% 0; } }
        .route-tile { transition: all 150ms ease; cursor: pointer; }
        .route-tile:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04); }
        .stat-card { animation: fadeIn 400ms ease both; }
        .stat-card:nth-child(2) { animation-delay: 50ms; }
        .stat-card:nth-child(3) { animation-delay: 100ms; }
        .stat-card:nth-child(4) { animation-delay: 150ms; }
        .group-section { animation: fadeIn 400ms ease both; }
        .group-section:nth-child(2) { animation-delay: 80ms; }
        .filter-btn { transition: all 120ms ease; }
        .filter-btn:hover { background: var(--bg-surface-hover) !important; }
        .detail-outer { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 250ms ease; }
        .detail-outer.open { grid-template-rows: 1fr; }
        .detail-inner { overflow: hidden; }
      `}</style>

      {/* Header */}
      <header
        style={{
          height: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          borderBottom: "1px solid var(--border-primary)",
          background: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img
            src="https://github.com/rhinestonewtf.png"
            alt="Rhinestone"
            width={22}
            height={22}
            style={{ borderRadius: 5 }}
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: "var(--text-primary)",
            }}
          >
            Route Health
          </span>
          {routes.length > 0 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                fontWeight: 500,
                padding: "2px 8px",
                borderRadius: "var(--radius-full)",
                background: totalUnhealthy === 0 ? "rgba(48, 164, 108, 0.08)" : "rgba(229, 72, 77, 0.08)",
                color: totalUnhealthy === 0 ? "#2b9a66" : "#cd2b31",
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: totalUnhealthy === 0 ? "#30a46c" : "#e5484d",
                  animation: totalUnhealthy > 0 ? "pulse 2s ease-in-out infinite" : undefined,
                }}
              />
              {totalUnhealthy === 0 ? "All systems operational" : `${totalUnhealthy} route${totalUnhealthy !== 1 ? "s" : ""} degraded`}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Filter */}
          <div
            style={{
              display: "flex",
              gap: 2,
              padding: 3,
              borderRadius: "var(--radius-sm)",
              background: "var(--bg-surface)",
            }}
          >
            {(["all", "sponsored", "unsponsored"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="filter-btn"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  padding: "4px 10px",
                  borderRadius: "calc(var(--radius-sm) - 2px)",
                  background: filter === f ? "#fff" : "transparent",
                  color: filter === f ? "var(--text-primary)" : "var(--text-tertiary)",
                  boxShadow: filter === f ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textTransform: "capitalize",
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {lastFetch && (
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              {timeAgo(lastFetch.toISOString())}
            </span>
          )}

          <button
            onClick={fetchHealth}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              fontWeight: 500,
              color: "var(--text-tertiary)",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              padding: "4px 6px",
              borderRadius: 6,
              transition: "all 120ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text-secondary)";
              e.currentTarget.style.background = "var(--bg-surface)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-tertiary)";
              e.currentTarget.style.background = "none";
            }}
          >
            <RefreshIcon />
            Refresh
          </button>
        </div>
      </header>

      {/* Content */}
      <div style={{ padding: "20px 28px 48px" }}>
        {/* Loading */}
        {loading && (
          <div style={{ padding: "80px 0", textAlign: "center" }}>
            <div
              style={{
                width: 200,
                height: 4,
                borderRadius: 2,
                margin: "0 auto 12px",
                background: "linear-gradient(90deg, var(--bg-surface) 0%, var(--bg-surface-hover) 50%, var(--bg-surface) 100%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.5s ease infinite",
              }}
            />
            <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
              Loading route health data...
            </span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "var(--radius-md)",
              background: "rgba(229, 72, 77, 0.06)",
              border: "1px solid rgba(229, 72, 77, 0.12)",
              color: "#cd2b31",
              fontSize: 13,
              marginBottom: 20,
            }}
          >
            Failed to fetch: {error}
          </div>
        )}

        {/* Stats row */}
        {!loading && routes.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 10,
              marginBottom: 24,
            }}
          >
            <StatCard
              label="Routes"
              value={`${routes.length}`}
              sub={`${filtered.length} shown`}
            />
            <StatCard
              label="Health"
              value={`${Math.round((totalHealthy / routes.length) * 100)}%`}
              sub={`${totalHealthy}/${routes.length} healthy`}
              accent={totalUnhealthy === 0 ? "#2b9a66" : "#cd2b31"}
            />
            <StatCard
              label="Avg Latency"
              value={`${avgLatency}ms`}
              sub={`p95 ${p95Latency}ms`}
              accent={LEVEL_COLORS[latencyLevel(avgLatency)].text}
            />
            <StatCard
              label="Worst"
              value={`${maxLatency}ms`}
              sub={`peak response`}
              accent={LEVEL_COLORS[latencyLevel(maxLatency)].text}
            />
          </div>
        )}

        {/* Route groups */}
        {!loading &&
          TARGET_GROUPS.map((group) => {
            const groupRoutes = filtered.filter(
              (r) => r.targetChainId === group.chainId,
            );
            if (groupRoutes.length === 0) return null;

            const groupHealthy = groupRoutes.filter((r) => r.healthy).length;
            const groupAvg = Math.round(
              groupRoutes.reduce((sum, r) => sum + r.latencyMs, 0) /
                groupRoutes.length,
            );

            // Group by source chain, then by token within each chain
            const sourceChains = [...new Set(groupRoutes.map((r) => r.sourceChainId))];

            return (
              <div
                key={group.chainId}
                className="group-section"
                style={{ marginBottom: 28 }}
              >
                {/* Group header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                    padding: "0 2px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {group.label}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: "var(--radius-full)",
                        background: "var(--bg-surface)",
                        color: "var(--text-tertiary)",
                        letterSpacing: "0.03em",
                        textTransform: "uppercase",
                      }}
                    >
                      {group.tag} &middot; {group.chainId}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      fontSize: 12,
                      color: "var(--text-tertiary)",
                    }}
                  >
                    <span>
                      <span style={{ fontWeight: 600, color: "#2b9a66" }}>
                        {groupHealthy}
                      </span>
                      /{groupRoutes.length} healthy
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-geist-mono), monospace",
                        fontWeight: 600,
                        color: LEVEL_COLORS[latencyLevel(groupAvg)].text,
                      }}
                    >
                      ~{groupAvg}ms avg
                    </span>
                  </div>
                </div>

                {/* Chain columns */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${sourceChains.length}, 1fr)`,
                    gap: 8,
                  }}
                >
                  {sourceChains.map((chainId) => {
                    const chainRoutes = groupRoutes.filter(
                      (r) => r.sourceChainId === chainId,
                    );
                    const chainHealthy = chainRoutes.every((r) => r.healthy);

                    return (
                      <div
                        key={chainId}
                        style={{
                          background: "#fff",
                          border: "1px solid var(--border-primary)",
                          borderRadius: "var(--radius-md)",
                          boxShadow: "var(--shadow-sm)",
                        }}
                      >
                        {/* Chain label */}
                        <div
                          style={{
                            padding: "8px 12px",
                            borderBottom: "1px solid var(--border-primary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: "50%",
                                background: chainHealthy ? "#30a46c" : "#e5484d",
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "var(--text-primary)",
                              }}
                            >
                              {CHAIN_NAMES[chainId] ?? chainId}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: "var(--text-tertiary)",
                              fontFamily: "var(--font-geist-mono), monospace",
                              letterSpacing: "0.02em",
                            }}
                          >
                            {CHAIN_SHORT[chainId] ?? chainId}
                          </span>
                        </div>

                        {/* Token rows */}
                        <div style={{ padding: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                          {chainRoutes.map((route) => {
                            const level = latencyLevel(route.latencyMs);
                            const colors = route.healthy ? LEVEL_COLORS[level] : UNHEALTHY_STYLE;
                            const isExpanded = expanded === route.key;

                            return (
                              <div key={route.key}>
                                <div
                                  className="route-tile"
                                  onClick={() => setExpanded(isExpanded ? null : route.key)}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "7px 10px",
                                    borderRadius: 7,
                                    background: colors.bg,
                                    border: `1px solid ${colors.border}`,
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: "var(--text-primary)",
                                      }}
                                    >
                                      {route.sourceTokenSymbol}
                                    </span>
                                    {route.settlementMode === "sponsored" && (
                                      <span
                                        style={{
                                          fontSize: 9,
                                          fontWeight: 700,
                                          color: "var(--text-tertiary)",
                                          textTransform: "uppercase",
                                          letterSpacing: "0.06em",
                                          opacity: 0.7,
                                        }}
                                      >
                                        SP
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    {!route.healthy && (
                                      <span style={{ fontSize: 10, color: "#cd2b31" }}>!</span>
                                    )}
                                    <span
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 700,
                                        fontFamily: "var(--font-geist-mono), monospace",
                                        color: colors.text,
                                        fontVariantNumeric: "tabular-nums",
                                      }}
                                    >
                                      {route.latencyMs < 1000
                                        ? `${route.latencyMs}ms`
                                        : `${(route.latencyMs / 1000).toFixed(1)}s`}
                                    </span>
                                  </div>
                                </div>

                                {/* Expanded detail */}
                                <div className={`detail-outer${isExpanded ? " open" : ""}`}>
                                  <div className="detail-inner">
                                    <div
                                      style={{
                                        marginTop: 4,
                                        marginBottom: 2,
                                        padding: "8px 10px",
                                        borderRadius: 6,
                                        background: "var(--bg-secondary)",
                                        fontSize: 11,
                                        color: "var(--text-tertiary)",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 3,
                                        lineHeight: 1.6,
                                      }}
                                    >
                                      <Detail label="Target" value={`${route.targetTokenSymbol} (${route.targetChainId})`} />
                                      <Detail label="Mode" value={route.settlementMode} />
                                      <Detail label="Latency" value={`${route.latencyMs}ms`} />
                                      <Detail label="Checked" value={timeAgo(route.lastCheckedAt)} />
                                      <Detail label="Source" value={truncAddr(route.sourceToken)} />
                                      <Detail label="Target" value={truncAddr(route.targetToken)} />
                                      {route.errorCode && (
                                        <Detail label="Error" value={`${route.errorCode}: ${route.errorMessage}`} />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

        {/* Latency legend */}
        {!loading && routes.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              marginTop: 8,
              fontSize: 11,
              color: "var(--text-tertiary)",
            }}
          >
            <span style={{ fontWeight: 500 }}>Latency:</span>
            {([
              ["good", "<600ms"],
              ["ok", "600–1s"],
              ["slow", "1–2s"],
              ["bad", ">2s"],
            ] as const).map(([level, label]) => (
              <span key={level} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 3,
                    background: LEVEL_COLORS[level].bg,
                    border: `1px solid ${LEVEL_COLORS[level].border}`,
                  }}
                />
                <span style={{ color: LEVEL_COLORS[level].text, fontWeight: 500 }}>{label}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────────── */

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: string;
}) {
  return (
    <div
      className="stat-card"
      style={{
        padding: "16px 18px",
        borderRadius: "var(--radius-md)",
        background: "#fff",
        border: "1px solid var(--border-primary)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          fontFamily: "var(--font-geist-mono), monospace",
          color: accent ?? "var(--text-primary)",
          letterSpacing: "-0.02em",
          lineHeight: 1,
          marginBottom: 4,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--text-tertiary)",
        }}
      >
        {sub}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={{ fontWeight: 600, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-geist-mono), monospace", textAlign: "right", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

function truncAddr(addr: string): string {
  if (addr === "ETH" || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/* ── Icons ───────────────────────────────────────────────── */

function RefreshIcon() {
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
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
    </svg>
  );
}
