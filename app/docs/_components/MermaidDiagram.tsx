"use client";

import { useEffect, useMemo, useState } from "react";

declare global {
  interface Window {
    mermaid?: {
      initialize: (config: Record<string, unknown>) => void;
      render: (
        id: string,
        chart: string,
      ) => Promise<{ svg: string }>;
      parseError?: (error: unknown) => void;
    };
  }
}

let mermaidScriptPromise: Promise<void> | null = null;

function loadMermaidScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (window.mermaid) {
    return Promise.resolve();
  }
  if (mermaidScriptPromise) {
    return mermaidScriptPromise;
  }

  mermaidScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Mermaid"));
    document.head.appendChild(script);
  });

  return mermaidScriptPromise;
}

export function MermaidDiagram({ chart }: { chart: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chartId = useMemo(
    () => `mermaid-${Math.random().toString(36).slice(2, 10)}`,
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        setError(null);
        await loadMermaidScript();
        if (!window.mermaid) {
          throw new Error("Mermaid unavailable");
        }

        window.mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: "neutral",
        });

        const result = await window.mermaid.render(chartId, chart);
        if (!cancelled) {
          setSvg(result.svg);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const message =
            e instanceof Error ? e.message : "Failed to render Mermaid diagram";
          setError(message);
          setSvg(null);
        }
      }
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [chart, chartId]);

  if (svg) {
    return (
      <div
        className="my-4 overflow-x-auto rounded-[12px] p-3"
        style={{
          border: "1px solid var(--border-primary)",
          background: "var(--bg-secondary)",
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }

  return (
    <div
      className="my-4 overflow-x-auto rounded-[12px]"
      style={{
        border: "1px solid var(--border-primary)",
        background: "var(--bg-secondary)",
      }}
    >
      <div
        className="px-3 py-1.5 text-[10px] uppercase tracking-[0.08em]"
        style={{
          borderBottom: "1px solid var(--border-primary)",
          color: "var(--text-tertiary)",
          fontFamily: "var(--font-code), var(--font-geist-mono), monospace",
        }}
      >
        Mermaid
      </div>
      <pre
        className="m-0 overflow-x-auto p-3.5 text-[12px] leading-[1.7]"
        style={{
          color: "#27272a",
          fontFamily: "var(--font-code), var(--font-geist-mono), monospace",
        }}
      >
        {chart}
      </pre>
      {error ? (
        <div className="px-3.5 pb-3 text-[12px]" style={{ color: "#b42318" }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
