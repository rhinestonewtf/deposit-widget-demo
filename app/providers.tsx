"use client";

import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const emptySubscribe = () => () => {};

function useHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-(--color-bg)">
      <div className="text-(--color-text-secondary)">Loading...</div>
    </div>
  );
}

const EmbeddedModeContext = createContext<{
  embeddedMode: boolean;
  setEmbeddedMode: (v: boolean) => void;
  privyAvailable: boolean;
  requestLogin: () => void;
}>({
  embeddedMode: false,
  setEmbeddedMode: () => {},
  privyAvailable: false,
  requestLogin: () => {},
});

export function useEmbeddedMode() {
  return useContext(EmbeddedModeContext);
}

function PrivyLoginBridge({
  children,
  loginRef,
}: {
  children: ReactNode;
  loginRef: React.RefObject<(() => void) | null>;
}) {
  const { login } = usePrivy();

  useEffect(() => {
    loginRef.current = login;
  });

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  const [embeddedMode, setEmbeddedMode] = useState(false);
  const loginRef = useRef<(() => void) | null>(null);
  const hydrated = useHydrated();

  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  const contextValue = useMemo(
    () => ({
      embeddedMode,
      setEmbeddedMode,
      privyAvailable: !!privyAppId,
      requestLogin: () => loginRef.current?.(),
    }),
    [embeddedMode, setEmbeddedMode, privyAppId],
  );

  if (!hydrated) {
    return <LoadingScreen />;
  }

  const inner = (
    <EmbeddedModeContext.Provider value={contextValue}>
      {children}
    </EmbeddedModeContext.Provider>
  );

  const wrapped = privyAppId ? (
    <PrivyProvider
      appId={privyAppId}
      config={{
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      <PrivyLoginBridge loginRef={loginRef}>{inner}</PrivyLoginBridge>
    </PrivyProvider>
  ) : (
    inner
  );

  return wrapped;
}
