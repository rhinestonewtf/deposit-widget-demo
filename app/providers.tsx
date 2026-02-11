"use client";

import {
  PrivyProvider,
  usePrivy,
  useWallets,
  getEmbeddedConnectedWallet,
} from "@privy-io/react-auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Address } from "viem";

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

type EmbeddedModeContextValue = {
  isEmbedded: boolean;
  embeddedAddress: Address | null;
  privyAvailable: boolean;
  requestLogin: () => void;
};

const EmbeddedModeContext = createContext<EmbeddedModeContextValue>({
  isEmbedded: false,
  embeddedAddress: null,
  privyAvailable: false,
  requestLogin: () => {},
});

export function useEmbeddedMode() {
  return useContext(EmbeddedModeContext);
}

function PrivyLoginBridge({
  children,
  loginRef,
  onEmbeddedStateChange,
}: {
  children: ReactNode;
  loginRef: React.RefObject<(() => void) | null>;
  onEmbeddedStateChange: (state: {
    isEmbedded: boolean;
    embeddedAddress: Address | null;
  }) => void;
}) {
  const { login } = usePrivy();
  const { wallets } = useWallets();

  useEffect(() => {
    loginRef.current = login;
  }, [login, loginRef]);

  useEffect(() => {
    const embeddedWallet = getEmbeddedConnectedWallet(wallets);
    onEmbeddedStateChange({
      isEmbedded: Boolean(embeddedWallet),
      embeddedAddress:
        (embeddedWallet?.address as Address | undefined) ?? null,
    });
  }, [wallets, onEmbeddedStateChange]);

  useEffect(() => {
    return () => {
      onEmbeddedStateChange({ isEmbedded: false, embeddedAddress: null });
    };
  }, [onEmbeddedStateChange]);

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  const [embeddedState, setEmbeddedState] = useState<{
    isEmbedded: boolean;
    embeddedAddress: Address | null;
  }>({
    isEmbedded: false,
    embeddedAddress: null,
  });
  const loginRef = useRef<(() => void) | null>(null);
  const hydrated = useHydrated();

  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  const handleEmbeddedStateChange = useCallback(
    (next: { isEmbedded: boolean; embeddedAddress: Address | null }) => {
      setEmbeddedState((prev) => {
        if (
          prev.isEmbedded === next.isEmbedded &&
          prev.embeddedAddress === next.embeddedAddress
        ) {
          return prev;
        }
        return next;
      });
    },
    [],
  );

  const contextValue = useMemo(
    () => ({
      isEmbedded: embeddedState.isEmbedded,
      embeddedAddress: embeddedState.embeddedAddress,
      privyAvailable: !!privyAppId,
      requestLogin: () => loginRef.current?.(),
    }),
    [embeddedState, privyAppId],
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
      <PrivyLoginBridge
        loginRef={loginRef}
        onEmbeddedStateChange={handleEmbeddedStateChange}
      >
        {inner}
      </PrivyLoginBridge>
    </PrivyProvider>
  ) : (
    inner
  );

  return wrapped;
}
