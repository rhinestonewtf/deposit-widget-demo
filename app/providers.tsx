"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import {
  base,
  optimism,
  arbitrum,
  type AppKitNetwork,
} from "@reown/appkit/networks";
import { WagmiProvider } from "wagmi";
import { useState, useEffect, type ReactNode } from "react";

const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  base,
  optimism,
  arbitrum,
];

let cachedAdapter: WagmiAdapter | null = null;
let appKitInitialized = false;

function getOrCreateAdapter(): WagmiAdapter | null {
  if (cachedAdapter) return cachedAdapter;

  const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;
  if (!projectId) {
    console.error("NEXT_PUBLIC_REOWN_PROJECT_ID is not set");
    return null;
  }

  cachedAdapter = new WagmiAdapter({
    networks,
    projectId,
  });

  if (!appKitInitialized) {
    createAppKit({
      adapters: [cachedAdapter],
      networks,
      projectId,
      metadata: {
        name: "Rhinestone Deposit Demo",
        description: "Demo app for Rhinestone Deposit Modal and Widget",
        url: typeof window !== "undefined" ? window.location.origin : "",
        icons: ["https://avatars.githubusercontent.com/u/179229932"],
      },
      features: {
        analytics: false,
      },
    });
    appKitInitialized = true;
  }

  return cachedAdapter;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
      <div className="text-[var(--color-text-secondary)]">Loading...</div>
    </div>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [hydrated, setHydrated] = useState(false);

  // Track hydration - this is intentionally in useEffect to run after hydration
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Server and initial client render show loading state to avoid hydration mismatch
  if (!hydrated) {
    return <LoadingScreen />;
  }

  // Now safe to initialize adapter (only runs on client after hydration)
  const adapter = getOrCreateAdapter();
  if (!adapter) {
    return <LoadingScreen />;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = adapter.wagmiConfig as any;

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
