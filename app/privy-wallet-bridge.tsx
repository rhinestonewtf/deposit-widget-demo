"use client";

import { useEffect } from "react";
import { useWallets, getEmbeddedConnectedWallet } from "@privy-io/react-auth";
import {
  createWalletClient,
  createPublicClient,
  custom,
  type Address,
  type WalletClient,
  type PublicClient,
} from "viem";

export interface PrivyWalletState {
  address: Address | null;
  walletClient: WalletClient | null;
  publicClient: PublicClient | null;
  switchChain: ((chainId: number) => Promise<void>) | null;
}

const EMPTY_STATE: PrivyWalletState = {
  address: null,
  walletClient: null,
  publicClient: null,
  switchChain: null,
};

export function PrivyWalletBridge({
  onChange,
}: {
  onChange: (state: PrivyWalletState) => void;
}) {
  const { wallets } = useWallets();

  useEffect(() => {
    const embeddedWallet = getEmbeddedConnectedWallet(wallets);
    if (!embeddedWallet) {
      onChange(EMPTY_STATE);
      return;
    }

    let cancelled = false;
    embeddedWallet.getEthereumProvider().then((provider) => {
      if (cancelled) return;

      const walletClient = createWalletClient({
        account: embeddedWallet.address as Address,
        transport: custom(provider),
      });

      const publicClient = createPublicClient({
        transport: custom(provider),
      });

      onChange({
        address: embeddedWallet.address as Address,
        walletClient,
        publicClient,
        switchChain: async (chainId: number) => {
          await embeddedWallet.switchChain(chainId);
        },
      });
    });

    return () => {
      cancelled = true;
    };
  }, [wallets, onChange]);

  useEffect(() => {
    return () => {
      onChange(EMPTY_STATE);
    };
  }, [onChange]);

  return null;
}
